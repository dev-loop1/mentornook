# api/serializers.py
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import models
from rest_framework import serializers
from .models import Profile, Connection

# Basic User Serializer (for nested display)
class BasicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name'] # Adjust fields as needed

# Profile Serializer (handles conversion between list/string for skills/interests)
class ProfileSerializer(serializers.ModelSerializer):
    user = BasicUserSerializer(read_only=True)
    name = serializers.SerializerMethodField(read_only=True)

    # **FIXED:** Expect strings for writing skills/interests
    skills = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text="Comma-separated skills")
    interests = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text="Comma-separated interests")

    # Keep these for reading the data as lists
    skills_list = serializers.SerializerMethodField(read_only=True)
    interests_list = serializers.SerializerMethodField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField(read_only=True)

    # **NEW:** Add connection status field
    connectionStatus = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'user', 'name', 'role', 'headline', 'bio',
            'skills', 'interests', # Write-only lists
            'skills_list', 'interests_list', # Read-only lists
            'profile_picture', 'profile_picture_url', # Raw field for upload, URL for display
            'location', 'linkedin_url', 'website_url',
            'connectionStatus',
            'updated_at'
        ]
        read_only_fields = ['user', 'id', 'updated_at', 'profile_picture_url', 'skills_list', 'interests_list', 'name', 'connectionStatus']
        extra_kwargs = {
            'profile_picture': {'write_only': True, 'required': False} # Handle upload separately
        }

    def get_name(self, obj):
        # Combine first and last name, fallback to username
        fname = obj.user.first_name
        lname = obj.user.last_name
        if fname and lname:
            return f"{fname} {lname}"
        
        return fname or lname or obj.user.username

    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if obj.profile_picture and hasattr(obj.profile_picture, 'url') and request:
            try:
                return request.build_absolute_uri(obj.profile_picture.url)
            except Exception as e:
                 print(f"Error building profile pic URL: {e}") # Log error
                 return None
        # Optional: return URL to a static default image if needed
        
        return None # Frontend will use its default if this is null

    def get_skills_list(self, obj):
         return obj.get_skills_list()

    def get_interests_list(self, obj):
         return obj.get_interests_list()
    
    def get_connectionStatus(self, obj):
        request = self.context.get('request')
        # Ensure request and user exist and are authenticated
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return 'none'

        user = request.user
        profile_user = obj.user # The user whose profile is being serialized

        if user == profile_user:
            return 'self'

        # Check for existing connection using Q objects for OR condition
        connection = Connection.objects.filter(
            (Q(requester=user) & Q(receiver=profile_user)) |
            (Q(requester=profile_user) & Q(receiver=user))
        ).first() # Get the first matching connection, if any

        if not connection:
            return 'none'
        elif connection.status == 'accepted':
            return 'connected'
        elif connection.status == 'pending':
            # Check who the requester was to determine sent/received
            return 'pending_sent' if connection.requester == user else 'pending_received'
        else: # Declined or other statuses treated as 'none' for button logic
            return 'none'

    # Override update/create to handle skills/interests list -> string conversion
    def _save_tags(self, instance, validated_data):
        if 'skills' in validated_data:
            instance.skills = ",".join(s.strip() for s in validated_data.pop('skills') if s.strip())
        if 'interests' in validated_data:
            instance.interests = ",".join(i.strip() for i in validated_data.pop('interests') if i.strip())
        instance.save() # Save tags separately if needed

    def update(self, instance, validated_data):
        # Handle tags first
        self._save_tags(instance, validated_data)
        # Handle profile picture upload if present
        profile_picture = validated_data.pop('profile_picture', None)
        if profile_picture:
             instance.profile_picture = profile_picture

        # Update other fields normally
        instance = super().update(instance, validated_data)
        return instance

    # Note: Create handled implicitly by signal creating profile, update is primary here.
    # If creating profiles via API directly is needed, override create() similarly.


# Add this new class IN api/serializers.py (before or after ProfileSerializer)

class BasicProfileSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = ['role', 'profile_picture_url'] # Specify only needed fields here

    def get_profile_picture_url(self, obj):
        # Re-use the same logic as in ProfileSerializer to get the full URL
        request = self.context.get('request')
        if obj.profile_picture and hasattr(obj.profile_picture, 'url') and request:
            try:
                return request.build_absolute_uri(obj.profile_picture.url)
            except: # Handle potential errors building URI if request context isn't quite right
                 return None
        # Handle default image URL if desired, otherwise return None
        return None
    

# Serializer for User Registration
class UserRegistrationSerializer(serializers.ModelSerializer):
    # Add first_name, last_name if desired in registration form
    first_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True, 'min_length': 8}}

    def validate_email(self, value):
        """Check if email is unique."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'], # create_user handles hashing
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        # Profile is created automatically via signal
        return user


# Serializer for displaying connection info
# Modify ConnectionSerializer IN api/serializers.py

class ConnectionSerializer(serializers.ModelSerializer):
    requester = BasicUserSerializer(read_only=True)
    receiver = BasicUserSerializer(read_only=True)
    # Use the new BasicProfileSerializer here
    requester_profile = BasicProfileSerializer(source='requester.profile', read_only=True)
    receiver_profile = BasicProfileSerializer(source='receiver.profile', read_only=True)

    class Meta:
        model = Connection
        fields = [
            'id',
            'requester',        # Basic user info
            'receiver',         # Basic user info
            'status',
            'created_at',
            'accepted_at',
            'requester_profile',# Contains only role & pic URL
            'receiver_profile' # Contains only role & pic URL
            ]
        read_only_fields = ['id', 'requester', 'receiver', 'created_at', 'accepted_at', 'requester_profile', 'receiver_profile']

# Serializer for creating a connection request
class ConnectionRequestSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(write_only=True) # ID of the user to connect with

    def validate_user_id(self, value):
        """Check if the target user exists and is not the requester."""
        request = self.context.get('request')
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Target user does not exist.")
        if request and request.user.id == value:
             raise serializers.ValidationError("You cannot send a connection request to yourself.")
        return value

    def create(self, validated_data):
        requester = self.context['request'].user
        receiver_id = validated_data['user_id']
        receiver = User.objects.get(id=receiver_id)

        # Check for existing pending/accepted connection
        existing = Connection.objects.filter(
            models.Q(requester=requester, receiver=receiver) |
            models.Q(requester=receiver, receiver=requester),
            status__in=['pending', 'accepted']
        ).first()

        if existing:
             raise serializers.ValidationError(f"A connection with this user already exists or is pending (Status: {existing.status}).")

        connection = Connection.objects.create(requester=requester, receiver=receiver)
        return connection # Return the created connection object

# Serializer for updating connection status (accept/decline)
class ConnectionUpdateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['accept', 'decline'], write_only=True)

    def update(self, instance, validated_data):
        action = validated_data['action']
        request = self.context['request']

        # Ensure the logged-in user is the receiver and status is pending
        if instance.receiver != request.user or instance.status != 'pending':
            raise serializers.ValidationError("You do not have permission to perform this action or request is not pending.")

        if action == 'accept':
            instance.status = 'accepted'
            instance.accepted_at = timezone.now()
        elif action == 'decline':
            instance.status = 'declined'
            # Alternatively, delete the declined request:
            # instance.delete()
            # return None # Indicate deletion if needed by view

        instance.save()
        return instance