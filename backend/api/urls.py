# api/urls.py
from django.urls import path
from . import views

# Define app_name if using namespaces (optional but good practice)
app_name = 'api'

urlpatterns = [
    # Authentication
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('login/', views.UserLoginView.as_view(), name='login'), # ObtainAuthToken handles POST
    path('logout/', views.UserLogoutView.as_view(), name='logout'), # POST request

    # Profile
    path('profile/', views.UserProfileView.as_view(), name='user-profile'), # GET, PUT, PATCH, DELETE for own profile
    path('profiles/<int:user_id>/', views.PublicProfileDetailView.as_view(), name='public-profile-detail'), # GET specific user profile

    # User Discovery
    path('users/', views.UserListView.as_view(), name='user-list'), # GET list with filters/search

    # Connections
    path('connections/', views.ConnectionListView.as_view(), name='connection-list'), # GET lists
    path('connections/request/', views.ConnectionRequestView.as_view(), name='connection-request'), # POST
    path('connections/<int:pk>/', views.ConnectionManageView.as_view(), name='connection-manage'), # PUT (accept/decline), DELETE (cancel/remove)
]