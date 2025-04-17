# api/views.py
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import generics, views, status, permissions, filters
from rest_framework.response import Response
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework import permissions
from .models import Profile # Or wherever your Profile model is defined
from django.contrib.auth.models import User
# Removed redundant import as IsOwnerOrReadOnly is defined in this file

from .models import Profile, Connection
from .serializers import (
    UserRegistrationSerializer, ProfileSerializer,
    ConnectionSerializer, ConnectionRequestSerializer, ConnectionUpdateSerializer
)
# from .permissions import IsOwnerOrReadOnly # Custom permission needed


# --- Custom Permissions ---
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object (profile) to edit it.
    Assumes the model instance has a `user` attribute.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the profile.
        # Handle Profile directly or User object associated with Profile
        if isinstance(obj, Profile):
             return obj.user == request.user
        elif isinstance(obj, User): # If operating on User object directly
             return obj == request.user
        return False


# --- Authentication Views ---
class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny] # Anyone can register

# Use DRF's built-in view for login, it returns the token
class UserLoginView(ObtainAuthToken):
     def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        # Include basic user info in login response along with token
        return Response({
            'token': token.key,
            'user': {
                'id': user.pk,
                'username': user.username,
                'email': user.email,
                'name': user.get_full_name() or user.username # Send combined name
            }
        })

class UserLogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Simply delete the token on the server
        try:
            request.user.auth_token.delete()
            return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        except (AttributeError, Token.DoesNotExist):
             return Response({"error": "No active session found or token missing."}, status=status.HTTP_400_BAD_REQUEST)


# --- Profile Views ---
class UserProfileView(generics.RetrieveUpdateDestroyAPIView):
    """
    View to retrieve, update, or delete the logged-in user's profile.
    """
    queryset = Profile.objects.select_related('user').all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_object(self):
        # Returns the profile object for the currently authenticated user
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        # Check object permissions explicitly after getting/creating
        self.check_object_permissions(self.request, profile)
        return profile

    def perform_destroy(self, instance):
        # Optional: Instead of deleting profile, maybe just deactivate user?
        # For now, delete profile. User deletion logic might be separate.
        user = instance.user # Get user before deleting profile if needed elsewhere
        instance.delete()
        # Maybe delete user too? Depends on requirements.
        # user.delete()


class PublicProfileDetailView(generics.RetrieveAPIView):
    """
    View to retrieve a specific user's profile publicly (read-only).
    Uses user ID in the URL.
    """
    queryset = Profile.objects.select_related('user').filter(user__is_active=True)
    serializer_class = ProfileSerializer
    permission_classes = [permissions.AllowAny] # Anyone can view profiles
    lookup_field = 'user_id' # Look up profile by user ID in URL


class UserListView(generics.ListAPIView):
    """
    View to list profiles for user discovery, with filtering and search.

    - Excludes the profile of the currently logged-in user (if authenticated).
    - Excludes users who haven't set a role or are inactive.
    - Accessible by anyone (controlled by permission_classes).
    - Supports filtering via query parameters:
        - `role`: Exact match (e.g., 'mentor', 'mentee').
        - `skills`: Comma-separated string; matches if profile contains ANY listed skill (case-insensitive).
        - `interests`: Comma-separated string; matches if profile contains ANY listed interest (case-insensitive).
        - `search`: Matches keywords in username, first/last name, bio, or headline (case-insensitive).
    - Uses default pagination defined in settings.
    - Orders results by username by default.
    """
    serializer_class = ProfileSerializer
    permission_classes = [permissions.AllowAny] # Allows Browse without needing to log in

    # Enable DRF's built-in search filter
    filter_backends = [filters.SearchFilter]
    # Define fields the 'search' query parameter (e.g., /api/users/?search=python) will target
    search_fields = [
        'user__username',
        'user__first_name',
        'user__last_name',
        'bio',
        'headline'
    ]

    def get_queryset(self):
        """
        Builds the queryset by filtering active users with roles,
        excluding the current user, and applying query parameter filters.
        """
        # Start with base queryset: Profiles linked to active users, excluding those with no role.
        # select_related('user') helps optimize by fetching user data in the same query.
        queryset = Profile.objects.select_related('user').filter(
            user__is_active=True
        ).exclude(role__isnull=True).exclude(role__exact='')

        # --- Exclude the currently logged-in user ---
        if self.request.user.is_authenticated:
            queryset = queryset.exclude(user=self.request.user)
        # --- End exclusion ---

        # --- Apply manual filtering based on query parameters ---
        # Role Filter
        role_filter = self.request.query_params.get('role', None)
        if role_filter:
            # Ensure the provided role is valid if using choices, otherwise direct filter:
            # if role_filter in dict(Profile.ROLE_CHOICES): # Example validation
            queryset = queryset.filter(role=role_filter)

        # Skills Filter (matches if profile contains ANY of the comma-separated skills)
        skills_query = self.request.query_params.get('skills', None)
        if skills_query:
             # Split, strip whitespace, and filter out empty strings
             skills = [s.strip() for s in skills_query.split(',') if s.strip()]
             if skills:
                # Create a Q object for each skill check (case-insensitive contains)
                # Combine them with OR (|) logic
                q_objects = Q()
                for skill in skills:
                    q_objects |= Q(skills__icontains=skill)
                queryset = queryset.filter(q_objects) # Apply the combined OR filter

        # Interests Filter (matches if profile contains ANY of the comma-separated interests)
        interests_query = self.request.query_params.get('interests', None)
        if interests_query:
             interests = [i.strip() for i in interests_query.split(',') if i.strip()]
             if interests:
                q_objects = Q()
                for interest in interests:
                    q_objects |= Q(interests__icontains=interest)
                queryset = queryset.filter(q_objects)
        # --- End manual filtering ---

        # Note: The 'search' filter (e.g., ?search=keyword) is applied automatically
        # by the SearchFilter backend using the `search_fields` defined above.

        # Apply default ordering
        return queryset.order_by('user__username')



# --- Connection Views ---
class ConnectionListView(views.APIView):
    """
    List incoming, outgoing, and current connections for the logged-in user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        incoming = Connection.objects.filter(receiver=user, status='pending').select_related('requester', 'requester__profile')
        outgoing = Connection.objects.filter(requester=user, status='pending').select_related('receiver', 'receiver__profile')
        current_sent = Connection.objects.filter(requester=user, status='accepted').select_related('receiver', 'receiver__profile')
        current_received = Connection.objects.filter(receiver=user, status='accepted').select_related('requester', 'requester__profile')

        # Combine current connections
        current_connections = list(current_sent) + list(current_received)
        # Sort current connections if needed, e.g., by acceptance date
        current_connections.sort(key=lambda x: x.accepted_at or x.created_at, reverse=True)


        # Serialize the data
        serializer_context = {'request': request}
        incoming_serializer = ConnectionSerializer(incoming, many=True, context=serializer_context)
        outgoing_serializer = ConnectionSerializer(outgoing, many=True, context=serializer_context)
        current_serializer = ConnectionSerializer(current_connections, many=True, context=serializer_context)


        return Response({
            'incoming': incoming_serializer.data,
            'outgoing': outgoing_serializer.data,
            'current': current_serializer.data
        })


class ConnectionRequestView(generics.CreateAPIView):
    """
    Send a connection request to another user.
    """
    serializer_class = ConnectionRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    # serializer.create handles the logic, using context={'request': request}


class ConnectionManageView(views.APIView):
    """
    Manage a connection: Accept, Decline, Cancel, Remove.
    Uses connection ID in the URL.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        """Helper method to get connection and check basic permission."""
        connection = get_object_or_404(Connection, pk=pk)
        # Check if the current user is involved in this connection
        if connection.requester != self.request.user and connection.receiver != self.request.user:
             raise permissions.PermissionDenied("You are not involved in this connection.")
        return connection

    # Handle PUT for Accept/Decline
    def put(self, request, pk, *args, **kwargs):
        connection = self.get_object(pk)
        serializer = ConnectionUpdateSerializer(instance=connection, data=request.data, context={'request': request})
        if serializer.is_valid():
            updated_instance = serializer.save()
            if updated_instance is None: # Handle case where 'decline' deletes the instance
                 return Response({"message": "Request declined."}, status=status.HTTP_204_NO_CONTENT)
            # Return updated connection details or just success
            return Response(ConnectionSerializer(updated_instance, context={'request': request}).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Handle DELETE for Cancel/Remove
    def delete(self, request, pk, *args, **kwargs):
        connection = self.get_object(pk)
        user = request.user

        # Logic for Cancel (Requester, Pending) or Remove (Either user, Accepted)
        if connection.status == 'pending' and connection.requester == user:
            # Cancel request
            connection.delete()
            return Response({"message": "Request cancelled."}, status=status.HTTP_204_NO_CONTENT)
        elif connection.status == 'accepted' and (connection.requester == user or connection.receiver == user):
            # Remove connection
            connection.delete()
            return Response({"message": "Connection removed."}, status=status.HTTP_204_NO_CONTENT)
        else:
             # User doesn't have permission or status doesn't allow deletion by this user
             return Response({"error": "You cannot perform this delete action."}, status=status.HTTP_403_FORBIDDEN)