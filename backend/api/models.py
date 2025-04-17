# api/models.py
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Profile(models.Model):
    ROLE_CHOICES = (
        ('mentor', 'Mentor'),
        ('mentee', 'Mentee'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, blank=True, null=True)
    headline = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    # Store skills/interests as comma-separated strings initially to match frontend
    # A ManyToManyField or a separate Skill model is better long-term
    skills = models.TextField(blank=True, help_text="Comma-separated skills")
    interests = models.TextField(blank=True, help_text="Comma-separated interests")
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True, default='profile_pics/profile_avatar_default.png')
    location = models.CharField(max_length=100, blank=True, null=True)
    linkedin_url = models.URLField(max_length=200, blank=True, null=True)
    website_url = models.URLField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

    # Helper methods to get skills/interests as lists
    def get_skills_list(self):
        if not self.skills:
            return []
        return [s.strip() for s in self.skills.split(',') if s.strip()]

    def get_interests_list(self):
        if not self.interests:
            return []
        return [i.strip() for i in self.interests.split(',') if i.strip()]

# Signal to create/update profile when User is created/updated
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    instance.profile.save()


class Connection(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    )

    requester = models.ForeignKey(User, related_name='sent_connections', on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name='received_connections', on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('requester', 'receiver') # Prevent duplicate requests in DB
        ordering = ['-created_at']

    def __str__(self):
        return f"Connection from {self.requester.username} to {self.receiver.username} ({self.status})"