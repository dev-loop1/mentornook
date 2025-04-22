# backend/api/serializers.py

from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q
from rest_framework import serializers
from .models import Profile, Connection 

# --- User Serializers ---

# Basic User representation for nesting in other serializers
class BasicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Fields typically needed to identify a user in lists/nested views
        fields = ['id', 'username', 'first_name', 'last_name']

# Serializer for creating a new User account
class UserRegistrationSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        # Fields required for registration
        fields = ['username', 'email', 'password', 'first_name', 'last_name']
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8}, # Ensure password isn't readable, enforce min length
            'email': {'required': True} # Make email required
            }

    def validate_email(self, value):
        """Ensure email is provided and unique."""
        if not value:
             raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=value).exists(): # Case-insensitive check
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_username(self, value):
        """Ensure username is unique."""
        if User.objects.filter(username__iexact=value).exists(): # Case-insensitive check
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def create(self, validated_data):
        """Creates the user instance using Django's helper."""
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'], # create_user handles hashing
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        # Associated Profile is created automatically via the post_save signal in models.py
        return user

# --- Profile Serializers ---

# Basic Profile representation (used for nesting within ConnectionSerializer)
class BasicProfileSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = ['role', 'profile_picture_url'] # Only include essential fields for connection lists

    def get_profile_picture_url(self, obj):
        """Returns the absolute URL for the profile picture."""
        request = self.context.get('request')
        if obj.profile_picture and hasattr(obj.profile_picture, 'url') and request:
            try:
                return request.build_absolute_uri(obj.profile_picture.url)
            except Exception as e:
                 # Log error if URL building fails
                 print(f"Error building profile pic URL in BasicProfileSerializer: {e}") # Keep print for error logging
                 return None
        return None # Return null if no picture

# Full Profile serializer for retrieving and updating profiles
class ProfileSerializer(serializers.ModelSerializer):
    user = BasicUserSerializer(read_only=True) # Nested read-only user details
    name = serializers.SerializerMethodField(read_only=True) # Calculated full name

    # Write-only fields expecting comma-separated strings from frontend
    skills = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text="Comma-separated skills")
    interests = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text="Comma-separated interests")

    # Read-only fields that convert stored strings back to lists for frontend display
    skills_list = serializers.SerializerMethodField(read_only=True)
    interests_list = serializers.SerializerMethodField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField(read_only=True)
    connectionStatus = serializers.SerializerMethodField(read_only=True) # Status relative to request user

    class Meta:
        model = Profile
        fields = [
            'id', 'user', 'name', 'role', 'headline', 'bio',
            'skills', 'interests', # Write-only strings
            'skills_list', 'interests_list', # Read-only lists derived from model methods
            'profile_picture', 'profile_picture_url', # Raw field for upload, URL for display
            'location', 'linkedin_url', 'website_url',
            'connectionStatus', # Connection status relative to request user
            'updated_at'
        ]
        # Fields that are set automatically or shouldn't be changed via this serializer directly
        read_only_fields = [
            'user', 'id', 'updated_at', 'profile_picture_url',
            'skills_list', 'interests_list', 'name', 'connectionStatus'
        ]
        # Specific handling for profile picture upload
        extra_kwargs = {
            'profile_picture': {'write_only': True, 'required': False, 'allow_null': True}
        }

    def get_name(self, obj):
        """Returns the user's full name or username."""
        fname = obj.user.first_name
        lname = obj.user.last_name
        if fname and lname: return f"{fname} {lname}"
        return fname or lname or obj.user.username

    def get_profile_picture_url(self, obj):
        """Returns the absolute URL for the profile picture."""
        request = self.context.get('request')
        if obj.profile_picture and hasattr(obj.profile_picture, 'url') and request:
            try:
                return request.build_absolute_uri(obj.profile_picture.url)
            except Exception as e:
                 # Log error if URL building fails
                 print(f"Error building profile pic URL in ProfileSerializer: {e}") # Keep print for error logging
                 return None
        # Return None if no picture, frontend should handle default image
        return None

    def get_skills_list(self, obj):
        """Returns skills as a list by splitting the stored string."""
        return obj.get_skills_list() # Calls the method defined on the Profile model

    def get_interests_list(self, obj):
        """Returns interests as a list by splitting the stored string."""
        return obj.get_interests_list() # Calls the method defined on the Profile model

    def get_connectionStatus(self, obj):
        """Determines connection status between request user and profile owner."""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return 'none' # Default status if cannot determine

        user = request.user
        profile_user = obj.user

        if user == profile_user: return 'self' # Viewing own profile

        # Query for connection involving both users
        connection = Connection.objects.filter(
            (Q(requester=user) & Q(receiver=profile_user)) |
            (Q(requester=profile_user) & Q(receiver=user))
        ).first()

        if not connection: return 'none'
        if connection.status == 'accepted': return 'connected'
        if connection.status == 'pending':
            return 'pending_sent' if connection.requester == user else 'pending_received'
        return 'none' # Default for declined or other states

    def update(self, instance, validated_data):
        """Handles updating the Profile instance."""
        # Handle profile picture update separately
        # Use get() with a default sentinel to differentiate 'not provided' from 'provided as null'
        profile_picture_data = validated_data.get('profile_picture', Ellipsis) # Ellipsis as sentinel

        if profile_picture_data is not Ellipsis:
            # If key was present (even if value is None for clearing), update the instance field
            instance.profile_picture = profile_picture_data

        # Update standard fields using validated_data.get(field, current_value)
        # This includes 'skills' and 'interests' which are now CharFields in validated_data
        instance.role = validated_data.get('role', instance.role)
        instance.headline = validated_data.get('headline', instance.headline)
        instance.bio = validated_data.get('bio', instance.bio)
        instance.location = validated_data.get('location', instance.location)
        instance.linkedin_url = validated_data.get('linkedin_url', instance.linkedin_url)
        instance.website_url = validated_data.get('website_url', instance.website_url)
        instance.skills = validated_data.get('skills', instance.skills) # Saves the string
        instance.interests = validated_data.get('interests', instance.interests) # Saves the string

        instance.save() # Save all updated fields
        return instance

# --- Connection Serializers ---

# Serializer for displaying connection details in lists
class ConnectionSerializer(serializers.ModelSerializer):
    # Use basic serializers for nested user/profile info to avoid excessive data
    requester = BasicUserSerializer(read_only=True)
    receiver = BasicUserSerializer(read_only=True)
    requester_profile = BasicProfileSerializer(source='requester.profile', read_only=True)
    receiver_profile = BasicProfileSerializer(source='receiver.profile', read_only=True)

    class Meta:
        model = Connection
        fields = [
            'id', 'requester', 'receiver', 'status',
            'created_at', 'accepted_at',
            'requester_profile', 'receiver_profile' # Include basic profile info
        ]
        read_only_fields = fields # All fields are read-only in this context

# Serializer for creating a new connection request
class ConnectionRequestSerializer(serializers.Serializer):
    # Expects the ID of the user to send the request to
    user_id = serializers.IntegerField(write_only=True)

    def validate_user_id(self, value):
        """Validate the target user ID."""
        request = self.context.get('request')
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Target user does not exist.")
        if request and request.user.id == value:
             raise serializers.ValidationError("You cannot send a connection request to yourself.")
        # Check for existing pending/accepted connection before allowing new request
        if request:
            requester = request.user
            receiver = User.objects.get(id=value) # Safe get after exists check
            existing = Connection.objects.filter(
                (Q(requester=requester, receiver=receiver) | Q(requester=receiver, receiver=requester)),
                status__in=['pending', 'accepted']
            ).exists() # Just check existence
            if existing:
                 raise serializers.ValidationError("A connection with this user already exists or is pending.")
        return value

    def create(self, validated_data):
        """Creates the connection request."""
        requester = self.context['request'].user
        receiver = User.objects.get(id=validated_data['user_id'])
        # Validation ensures no duplicate pending/accepted request exists
        connection = Connection.objects.create(requester=requester, receiver=receiver, status='pending')
        return connection

# Serializer for updating connection status (Accept/Decline) via PUT
class ConnectionUpdateSerializer(serializers.Serializer):
    # Expects 'accept' or 'decline' in the request body
    action = serializers.ChoiceField(choices=['accept', 'decline'], write_only=True)

    def update(self, instance, validated_data):
        """Updates the connection status based on the action."""
        action = validated_data['action']
        request = self.context['request']

        # Permission check: Only the receiver of a pending request can accept/decline
        if instance.receiver != request.user or instance.status != 'pending':
            raise serializers.ValidationError("Action not allowed.")

        if action == 'accept':
            instance.status = 'accepted'
            instance.accepted_at = timezone.now()
        elif action == 'decline':
            instance.status = 'declined'
            # Consider deleting declined requests immediately or after some time
            # instance.delete()
            # return instance # Return instance even if declined (or None if deleted)

        instance.save()
        return instance

