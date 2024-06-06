import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom"
import Home from '../routes/Home'
import Error from '../routes/Error'
import Configuration from '../routes/Configuration'
import List from '../routes/List'
import Media from '../routes/Media'
import Upload from '../routes/Upload'
import User from '../routes/User'
import Permission from '../routes/Permission'
import { AuthProvider } from '../contexts/authContext'
import ProtectedRoute from '../routes/ProtectedRoute'
import { role } from '../utils/userRoles'
import Info from '../routes/Info'

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    errorElement: <Error />
  },
  {
    path: "/config",
    element: <ProtectedRoute requiredRole={role.editor}><Configuration /></ProtectedRoute>,
    errorElement: <Error />
  },
  // Redirect old urls for now
  {
    path: "/videos",
    element: <Navigate to="/list" replace />,
    errorElement: <Error />
  },
  {
    path: "/list",
    element: <ProtectedRoute requiredRole={role.viewer}><List /></ProtectedRoute>,
    errorElement: <Error />
  },
  {
    path: "/media/:mediaId",
    element: <ProtectedRoute requiredRole={role.viewer}><Media /></ProtectedRoute>,
    errorElement: <Error />
  },
  {
    path: "/upload",
    element: <ProtectedRoute requiredRole={role.uploader}><Upload /></ProtectedRoute>,
    errorElement: <Error />
  },
  {
    path: "/info",
    element: <Info />,
    errorElement: <Error />
  },
  {
    path: "/user",
    element: <User />,
    errorElement: <Error />
  },
  {
    path: "/permission",
    element: <Permission />,
    errorElement: <Error />
  },
  {
    path: "*",
    element: <Error />
  }
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
