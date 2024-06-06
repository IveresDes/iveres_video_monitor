import { Delete as DeleteIcon } from '@mui/icons-material'
import {
  Button, Container, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Grid, TextField, Typography
} from '@mui/material'
import { DataGrid, GridActionsCellItem, GridToolbar } from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'
import Header from '../components/Header'

export default function Configuration() {
  const deleteDialogStateInit = { open: false, data: {} }

  const [channels, setChannels] = useState([])
  const [newChannelUrl, setNewChannelUrl] = useState("")
  const [deleteDialogState, setDeleteDialogState] = useState(deleteDialogStateInit)
  const [paginationModel, setPaginationModel] = useState({ pageSize: 50, page: 0 })
  const [isLoading, setIsLoading] = useState(false)

  const channelDeleter = (data) => () => {
    setDeleteDialogState({ open: true, data })
  }

  const columns = [
    {
      field: 'platform',
      headerName: 'Plataforma',
      width: 100,
      type: 'singleSelect',
      valueOptions: ['youtube', 'tiktok'],
    },
    {
      field: 'channelName',
      headerName: 'Nombre canal',
      width: 300,
    },
    {
      field: 'channelId',
      headerName: 'Id canal',
      width: 250,
    },
    {
      field: 'monitoringUsers',
      headerName: 'Fecha añadido',
      width: 150,
      type: 'dateTime',
      valueGetter: ({ value }) => value && new Date(value[0].subscribeDatetime),
    },
    {
      field: 'actions',
      type: 'actions',
      getActions: (params) => [
        <GridActionsCellItem
          icon={<DeleteIcon />}
          onClick={channelDeleter(params.row)}
          label="Delete"
        />,
      ]
    },
  ]

  function deleteChannel(id) {
    setIsLoading(true)
    const init = { method: 'DELETE' }
    fetch(`/api/watchlist/${id}`, init)
      .then(res => res.json())
      .then(data => updateChannels())
      .catch(err => console.debug(err))
      .finally(() => setIsLoading(false))
  }

  function onDeleteDialogCancel() {
    setDeleteDialogState(deleteDialogStateInit)
  }

  function onDeleteDialogConfirm() {
    deleteChannel(deleteDialogState.data._id)
    setDeleteDialogState(deleteDialogStateInit)
  }

  function updateChannels() {
    setIsLoading(true)
    fetch("/api/watchlist")
      .then(res => res.json())
      .then(data => setChannels(data.map(obj => ({ id: obj._id, ...obj }))))
      .catch(err => console.debug(err))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    updateChannels()
  }, [])

  function handleSubmit(ev) {
    ev.preventDefault()
    setIsLoading(true)
    const newChannelInfo = { link: newChannelUrl }
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newChannelInfo),
    }
    fetch('/api/watchlist', init)
      .then(res => res.json())
      .then(data => {
        updateChannels()
      })
      .catch(err => console.debug(err))
      .finally(() => setIsLoading(false))
    setNewChannelUrl("")
  }

  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ width: '100%', marginTop: 20, marginBottom: 20 }}
      >
        <Typography variant="h5" gutterBottom>Configurar</Typography>
        <Grid
          container
          spacing={2}
          component="form"
          onSubmit={handleSubmit}
          noValidate
        >
          <Grid item xs={12}>
            <Typography variant="h6">Añadir nuevo canal</Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Url a un video del canal"
              fullWidth
              value={newChannelUrl}
              placeholder="https://www.plataforma.com/@ejemplo/video/123456"
              onChange={ev => setNewChannelUrl(ev.target.value)}
              required
            />
          </Grid>
          <Grid container item xs={12} justifyContent="center">
            <Button
              type="submit"
              variant="contained"
              sx={{ mb: 3 }}
              disabled={isLoading}
            >
              Añadir
            </Button>
          </Grid>
        </Grid>
        <Typography variant="h6" gutterBottom>Canales</Typography>
        <div style={{ height: "calc(100vh - 64px - 80px)", width: "100%" }}>
          <DataGrid
            columns={columns}
            rows={channels}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            slots={{ toolbar: GridToolbar }}
            loading={isLoading}
          />
        </div>
        <Dialog
          open={deleteDialogState.open}
          onClose={onDeleteDialogCancel}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            Confirmación borrado
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              ¿Seguro que quieres borrar el canal <b>{deleteDialogState.data.channelId} ({deleteDialogState.data.channelName})</b> de la monitorización?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={onDeleteDialogCancel} autoFocus>Cancelar</Button>
            <Button onClick={onDeleteDialogConfirm} color="error">Borrar</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  )
}
