import React, { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../contexts/authContext'
import { rolePermissions } from '../utils/userRoles'
import UserLoading from './UserLoading'

export default function ProtectedRoute({ requiredRole, children }) {
  const { authState } = useContext(AuthContext)
  const location = useLocation()

  if (!authState.isLoaded) {
    return <UserLoading />
  }

  if (!authState.role) {
    return <Navigate to="/user" replace state={{ navigateToAfterLogin: location.pathname }} />
  }

  if (rolePermissions[authState.role] < rolePermissions[requiredRole]) {
    return <Navigate to="/permission" replace />
  }

  return children
}
