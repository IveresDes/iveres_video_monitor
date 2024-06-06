import { CircularProgress, Container, Grid } from '@mui/material'
import React from 'react'
import Header from '../components/Header'

export default function UserLoading() {
  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ height: 500, width: '100%', marginTop: 20 }}
      >
        <Grid
          container
          alignItems="center"
          justifyContent="center"
        >
          <Grid item><CircularProgress /></Grid>
        </Grid>
      </Container>
    </div>
  )
}

