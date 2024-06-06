import React, { useState } from 'react';
import {
  AppBar, Box, Toolbar, IconButton, Link, Stack, Container, Avatar, Menu,
  MenuItem, Typography
} from '@mui/material'
import { Menu as MenuIcon } from '@mui/icons-material'
import { Link as RouterLink } from 'react-router-dom'

const pages = [
  { name: 'Lista', path: '/list' },
  { name: 'Cargar', path: '/upload' },
  { name: 'Configurar', path: '/config' },
  { name: 'Usuario', path: '/user' },
  { name: 'Información', path: '/info' },
]

const maintenance = { isActive: false, datetimeStr: '13/04 - 10:00h' }

export default function Header() {
  const [anchorElNav, setAnchorElNav] = useState(null)

  function handleOpenNavMenu(ev) {
    setAnchorElNav(ev.currentTarget)
  }

  function handleCloseNavMenu() {
    setAnchorElNav(null)
  }

  return (
    <AppBar
      component="nav"
      position="static"
      style={{ background: '#fff', color: '#333' }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          <Box >
            <Avatar
              component={RouterLink}
              to="/"
              variant="square"
              sx={{ width: 64, height: 64 }}
              src={`${process.env.PUBLIC_URL}/logo192.png`}
              alt="Logo iveres"
            />
          </Box>
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              ml: 2,
              color: '#b105a7',
              textDecoration: 'none',
            }}
          >
            Monitorización
          </Typography>
          {
            maintenance.isActive &&
            <Box sx={{ width: "100%" }}>
              <Typography align="center" color="secondary" variant="body2">
                Mantenimiento programado: dia {maintenance.datetimeStr} (la página no estará accesible)
              </Typography>
            </Box>
          }
          <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map((page) => (
                <MenuItem key={page.name} onClick={handleCloseNavMenu}>
                  <Link
                    component={RouterLink}
                    to={page.path}
                    underline="none"
                    variant="button"
                    color="inherit"
                  >
                    {page.name}
                  </Link>
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <Stack
            direction="row"
            spacing={3}
            sx={{ display: { xs: 'none', md: 'block' } }}
          >
            {pages.map((page) => (
              <Link
                key={page.name}
                component={RouterLink}
                to={page.path}
                underline="none"
                variant="button"
                color="inherit"
              >
                {page.name}
              </Link>
            ))}
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  )
}