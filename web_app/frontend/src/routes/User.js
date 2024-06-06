import { Box, Button, Container, Grid, TextField, Typography } from '@mui/material'
import React, { useContext, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { AuthContext } from '../contexts/authContext'
import UserLoading from './UserLoading'

export default function User() {
  const location = useLocation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { authState, doLogin, doLogout } = useContext(AuthContext)

  async function handleSubmit(ev) {
    ev.preventDefault()
    try {
      await doLogout()
      await doLogin(username, password)
      setUsername('')
      setPassword('')
      if (location.state.navigateToAfterLogin) {
        navigate(location.state.navigateToAfterLogin)
      }
    } catch (error) {
      setError("Login error")
    }
  }

  async function onClickLogout() {
    await doLogout()
  }

  if (!authState.isLoaded) {
    return <UserLoading />
  }

  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ height: 500, width: '100%', marginTop: 20 }}
      >
        {authState.username ?
          <>
            <Typography variant="h5" gutterBottom>Usuario</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Typography variant="body1">
                  Nombre y rol: <b>{authState.username} ({authState.role})</b>
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={onClickLogout}
                  disabled={!authState.username}
                >
                  Logout
                </Button>
              </Grid>
            </Grid>
          </>
          :
          <>
            <Typography variant="h5" gutterBottom>Iniciar sesión</Typography>
            <Box
              component="form"
              noValidate
              method="post"
              onSubmit={handleSubmit}
              sx={{ mt: 1 }}
            >
              <Typography variant="body1" color="error">{error}</Typography>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Usuario"
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={ev => setUsername(ev.target.value)}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Contraseña"
                id="current-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={ev => setPassword(ev.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
              >
                Entrar
              </Button>
            </Box>
          </>
        }
      </Container>
    </div>
  )
}

