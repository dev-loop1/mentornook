# backend/api/views.py

from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import generics, views, status, permissions, filters
from rest_framework.response import Response
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

# Import local models and serializers
from .models import Profile, Connection
from .serializers import (
    UserRegistrationSerializer, ProfileSerializer, ConnectionSerializer,
    ConnectionRequestSerializer, ConnectionUpdateSerializer
    # BasicUserSerializer and BasicProfileSerializer are used within other serializers
)

# --- Custom Permissions ---

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission: Allows read-only access to anyone, but only allows
    write/update/delete operations if the request user is the owner
    of the associated User object (for Profiles).
    """
    def has_object_permission(self, request, view, obj):
        # SAFE_METHODS are GET, HEAD, OPTIONS - allow these for anyone
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions check: requires object owner == request user
        if isinstance(obj, Profile):
             return obj.user == request.user
        # Add checks for other models if needed, e.g., if User model itself was directly editable
        # elif isinstance(obj, User):
        #      return obj == request.user
        return False


# --- Authentication Views ---

class UserRegistrationView(generics.CreateAPIView):
    """Handles new user registration."""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny] # Allow any user (authenticated or not) to register

class UserLoginView(ObtainAuthToken):
    """Handles user login and returns an authentication token."""
    # Inherits standard DRF token generation logic
    # Overrides post to include basic user info alongside the token
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True) # Raises validation errors automatically
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': { # Return basic user info needed by frontend
                'id': user.pk,
                'username': user.username,
                'email': user.email,
                'name': user.get_full_name() or user.username
            }
        })

class UserLogoutView(views.APIView):
    """Handles user logout by deleting the authentication token."""
    permission_classes = [permissions.IsAuthenticated] # Must be logged in to log out

    def post(self, request, *args, **kwargs):
        """Deletes the user's auth token."""
        try:
            request.user.auth_token.delete()
            return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        except (AttributeError, Token.DoesNotExist):
             # Handle cases where token might already be deleted or doesn't exist
             return Response({"error": "No active session found or token missing."}, status=status.HTTP_400_BAD_REQUEST)


# --- Profile Views ---

class UserProfileView(generics.RetrieveUpdateDestroyAPIView):
    """
    Handles retrieving, updating (PUT/PATCH), and deleting the
    profile associated with the *currently authenticated* user.
    """
    queryset = Profile.objects.select_related('user').all()
    serializer_class = ProfileSerializer
    # User must be authenticated and the owner of the profile to modify/delete
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_object(self):
        """Returns the profile object for the request user, creating if needed."""
        # Using get_or_create simplifies handling for users who haven't saved profile details yet
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        # Check permissions against the retrieved/created object
        self.check_object_permissions(self.request, profile)
        return profile

    def perform_destroy(self, instance):
        """Deletes the user's profile (but not the User account itself)."""
        # Consider if deleting the User account should also happen here or elsewhere
        instance.delete()


class PublicProfileDetailView(generics.RetrieveAPIView):
    """
    Handles retrieving any active user's profile details (read-only).
    Lookup is based on the user ID provided in the URL.
    """
    queryset = Profile.objects.select_related('user').filter(user__is_active=True)
    serializer_class = ProfileSerializer
    permission_classes = [permissions.AllowAny] # Allow anyone to view profiles
    lookup_field = 'user_id' # Use 'user_id' from URL pattern (e.g., /profiles/<int:user_id>/)


# --- User Discovery View ---

class UserListView(generics.ListAPIView):
    """
    Handles listing user profiles for discovery on the dashboard.
    Supports filtering (role, skills, interests) and searching.
    Excludes the logged-in user from the results.
    """
    serializer_class = ProfileSerializer
    permission_classes = [permissions.AllowAny] # Allow browsing without login

    # Configure DRF's built-in SearchFilter
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'bio', 'headline']

    # Default pagination is handled by settings.py

    def get_queryset(self):
        """Builds the queryset, applying filters and excluding the current user."""
        # Start with active users who have set a role
        queryset = Profile.objects.select_related('user').filter(
            user__is_active=True
        ).exclude(role__isnull=True).exclude(role__exact='')

        # Exclude the requesting user if they are logged in
        if self.request.user.is_authenticated:
            queryset = queryset.exclude(user=self.request.user)

        # Apply manual filters from query parameters
        role_filter = self.request.query_params.get('role', None)
        skills_query = self.request.query_params.get('skills', None)
        interests_query = self.request.query_params.get('interests', None)

        if role_filter:
            queryset = queryset.filter(role=role_filter)

        # Filter by skills (comma-separated, case-insensitive contains OR logic)
        if skills_query:
             skills = [s.strip() for s in skills_query.split(',') if s.strip()]
             if skills:
                q_objects = Q()
                for skill in skills: q_objects |= Q(skills__icontains=skill)
                queryset = queryset.filter(q_objects)

        # Filter by interests (comma-separated, case-insensitive contains OR logic)
        if interests_query:
             interests = [i.strip() for i in interests_query.split(',') if i.strip()]
             if interests:
                q_objects = Q()
                for interest in interests: q_objects |= Q(interests__icontains=interest)
                queryset = queryset.filter(q_objects)

        # Apply default ordering
        return queryset.order_by('user__username')


# --- Connection Views ---

class ConnectionListView(views.APIView):
    """
    Lists connections for the authenticated user, categorized into
    incoming pending, outgoing pending, and current accepted connections.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """Handles GET request to retrieve connection lists."""
        user = request.user
        # Optimize queries using select_related for user and profile details
        incoming = Connection.objects.filter(receiver=user, status='pending').select_related('requester', 'requester__profile')
        outgoing = Connection.objects.filter(requester=user, status='pending').select_related('receiver', 'receiver__profile')
        # Get current connections where user is either requester or receiver
        current_connections_qs = Connection.objects.filter(
            Q(requester=user, status='accepted') | Q(receiver=user, status='accepted')
        ).select_related('requester', 'requester__profile', 'receiver', 'receiver__profile')
        # Sort current connections, e.g., by acceptance date descending (newest first)
        current_connections = sorted(current_connections_qs, key=lambda x: x.accepted_at or x.created_at, reverse=True)

        # Serialize the data, passing request context for URL generation
        serializer_context = {'request': request}
        return Response({
            'incoming': ConnectionSerializer(incoming, many=True, context=serializer_context).data,
            'outgoing': ConnectionSerializer(outgoing, many=True, context=serializer_context).data,
            'current': ConnectionSerializer(current_connections, many=True, context=serializer_context).data
        })


class ConnectionRequestView(generics.CreateAPIView):
    """Handles sending (POSTing) a new connection request."""
    serializer_class = ConnectionRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    # The serializer's create method handles validation and object creation


class ConnectionManageView(views.APIView):
    """
    Handles managing an existing connection request or connection:
    - PUT: Accept / Decline a pending request (requires 'action' in data).
    - DELETE: Cancel an outgoing pending request OR Remove an accepted connection.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        """Helper method to get the Connection object and check user involvement."""
        connection = get_object_or_404(Connection, pk=pk)
        # Ensure the logged-in user is either the requester or receiver
        if connection.requester != self.request.user and connection.receiver != self.request.user:
             raise permissions.PermissionDenied("You are not involved in this connection.")
        return connection

    def put(self, request, pk, *args, **kwargs):
        """Handles Accept/Decline actions."""
        connection = self.get_object(pk) # Checks involvement
        # Use ConnectionUpdateSerializer to validate action and update status
        serializer = ConnectionUpdateSerializer(instance=connection, data=request.data, context={'request': request})
        if serializer.is_valid():
            updated_instance = serializer.save()
            if updated_instance is None: # Handle cases where serializer might delete (e.g., decline)
                 return Response({"message": "Request declined/processed."}, status=status.HTTP_204_NO_CONTENT)
            # Return updated connection details
            return Response(ConnectionSerializer(updated_instance, context={'request': request}).data, status=status.HTTP_200_OK)
        # Return validation errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, *args, **kwargs):
        """Handles Cancel (outgoing pending) or Remove (accepted) actions."""
        connection = self.get_object(pk) # Checks involvement
        user = request.user

        # Determine if action is allowed based on status and user role
        can_cancel = (connection.status == 'pending' and connection.requester == user)
        can_remove = (connection.status == 'accepted' and (connection.requester == user or connection.receiver == user))

        if can_cancel:
            connection.delete()
            return Response({"message": "Request cancelled."}, status=status.HTTP_204_NO_CONTENT)
        elif can_remove:
            connection.delete()
            return Response({"message": "Connection removed."}, status=status.HTTP_204_NO_CONTENT)
        else:
             # If neither condition met, user cannot perform delete action
             return Response({"error": "You cannot perform this delete action on this connection."}, status=status.HTTP_403_FORBIDDEN)

