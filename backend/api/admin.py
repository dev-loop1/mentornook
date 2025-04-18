# backend/api/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils.html import format_html
from django.db.models import Q

from .models import Profile, Connection


# --- User Admin Configuration ---

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'User Profile'
    fk_name = 'user'
    # Define fields shown inline
    fields = ('role', 'headline', 'profile_picture', 'bio', 'skills', 'interests', 'location', 'linkedin_url', 'website_url')


class UserAdmin(BaseUserAdmin):
    inlines = (ProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_profile_role', 'date_joined')
    list_filter = BaseUserAdmin.list_filter + ('profile__role',)
    search_fields = BaseUserAdmin.search_fields + ('profile__headline', 'profile__bio')
    list_select_related = ('profile',)

    @admin.display(description='Role', ordering='profile__role')
    def get_profile_role(self, instance):
        """Returns the role's display name from the related profile."""
        if hasattr(instance, 'profile') and instance.profile and instance.profile.role:
            return instance.profile.get_role_display()
        return '-'


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


# --- Profile Admin Configuration ---

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user_link', 'role', 'headline', 'updated_at')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'headline', 'bio', 'skills', 'interests', 'location')
    list_select_related = ('user',)
    readonly_fields = ('user', 'created_at', 'updated_at')
    raw_id_fields = ('user',) # Improves performance for User selection

    fieldsets = (
        (None, {'fields': ('user', 'role', 'headline', 'profile_picture')}),
        ('Details', {'fields': ('bio', 'skills', 'interests')}), # Note: skills/interests are comma-sep strings
        ('Contact & Links', {'fields': ('location', 'linkedin_url', 'website_url')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    @admin.display(description='User', ordering='user__username')
    def user_link(self, obj):
        """Returns an HTML link to the related User's admin change page."""
        link = reverse("admin:auth_user_change", args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', link, obj.user.username)


# --- Connection Admin Configuration ---

@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'requester_link', 'receiver_link', 'status', 'created_at', 'accepted_at')
    list_filter = ('status',)
    search_fields = ('requester__username', 'receiver__username')
    list_select_related = ('requester', 'receiver')
    # Most fields are read-only as they represent connection state
    readonly_fields = ('requester', 'receiver', 'created_at', 'accepted_at')
    date_hierarchy = 'created_at'
    raw_id_fields = ('requester', 'receiver') # Improves performance

    @admin.display(description='Requester', ordering='requester__username')
    def requester_link(self, obj):
        """Returns an HTML link to the requester User's admin change page."""
        link = reverse("admin:auth_user_change", args=[obj.requester.id])
        return format_html('<a href="{}">{}</a>', link, obj.requester.username)

    @admin.display(description='Receiver', ordering='receiver__username')
    def receiver_link(self, obj):
        """Returns an HTML link to the receiver User's admin change page."""
        link = reverse("admin:auth_user_change", args=[obj.receiver.id])
        return format_html('<a href="{}">{}</a>', link, obj.receiver.username)

