import { Link, Container, Grid, Typography } from '@mui/material'
import React from 'react'
import Header from '../components/Header'
import { Link as RouterLink } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ height: 500, width: '100%', marginTop: 20, marginBottom: 20 }}
      >
        <Typography variant="body1" gutterBottom align="center">
          Este usuario no tiene premiso para acceder a esta página.
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          <Grid item>
            <Link
              component={RouterLink}
              to="/user"
              underline="none"
              variant="button"
            >
              Ir a usuario
            </Link>
          </Grid>
          <Grid item>
            <Link
              component={RouterLink}
              to={-1}
              underline="none"
              variant="button"
            >
              Volver
            </Link>
          </Grid>
        </Grid>
      </Container>
    </div>
  )
}
