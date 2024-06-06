import { OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import { Container, Typography } from '@mui/material'
import {
  DataGrid, GridActionsCellItem, GridToolbarColumnsButton, GridToolbarContainer,
  GridToolbarDensitySelector, GridToolbarFilterButton
} from '@mui/x-data-grid'
import React, { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useLocalStorage } from '../utils/useLocalStorage'

const columns = [
  {
    field: 'status',
    headerName: 'Estado',
    width: 92,
    type: 'singleSelect',
    valueOptions: ['downloaded', 'transcribed', 'analyzed', 'stored', 'archived', 'error'],
  },
  {
    field: 'platform',
    headerName: 'Plataforma',
    width: 85,
  },
  {
    field: 'uploader',
    headerName: 'Nombre canal',
    width: 150,
  },
  {
    field: 'title',
    headerName: 'Título',
    flex: 1,
    minWidth: 200,
  },
  {
    field: 'uploadDatetime',
    headerName: 'Fecha subida',
    width: 160,
    type: 'dateTime',
    valueGetter: ({ value }) => value && new Date(value),
  },
  {
    field: 'source',
    headerName: 'Fuente',
    width: 125,
    type: 'singleSelect',
    valueOptions: ['tiktokMonitor', 'youtubeMonitor', 'manualRequest', 'fileUpload'],
  },
  {
    field: 'actions',
    type: 'actions',
    width: 50,
    getActions: (params) => [
      <GridActionsCellItem
        icon={<OpenInNewIcon />}
        label='OpenInNew'
        component={RouterLink}
        to={`/media/${params.id}`}
        target='_blank'
        rel='noopener noreferrer'
      />,
    ]
  },
]

function CustomToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
    </GridToolbarContainer>
  )
}

export default function List() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [paginationModel, setPaginationModel] = useState({ pageSize: 50, page: 0 })
  const [totalItems, setTotalItems] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [columnVisibilityModel, setColumnVisibilityModel] = useLocalStorage('columnVisibilityModel', {})

  const updateList = useCallback(() => {
    const searchParams = new URLSearchParams(
      { page: paginationModel.page, size: paginationModel.pageSize }
    )
    fetch(`/api/media?${searchParams}`)
      .then(res => res.json())
      .then(data => {
        setTotalItems(data.totalItems)
        const listData = data.pageData.map(obj => ({
          id: obj._id,
          source: obj.requests[0].source,
          platform: obj.platform,
          status: obj.status,
          uploader: obj.platformMetadata?.uploader,
          uploadDatetime: obj.platformMetadata?.uploadDatetime,
          title: obj.platformMetadata?.title,
        }))
        setList(listData)
        setIsLoading(false)
      })
      .catch(err => console.error(err))
  }, [paginationModel])

  useEffect(() => {
    updateList()
    let intervalID = setInterval(updateList, 3000)
    return () => { clearInterval(intervalID) }
  }, [updateList])

  function onRowClick(params, ev, details) {
    navigate(`/media/${params.id}`)
  }

  useEffect(() => {
    setIsLoading(true)
    updateList()
  }, [paginationModel, updateList])

  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ width: '100%', marginTop: 20, marginBottom: 20 }}
      >
        <Typography variant="h5" gutterBottom>Lista</Typography>
        <div style={{ height: "calc(100vh - 64px - 80px)", width: "100%" }}>
          <DataGrid
            columns={columns}
            rows={list}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            paginationMode="server"
            rowCount={totalItems}
            loading={isLoading}
            slots={{ toolbar: CustomToolbar }}
            onRowClick={onRowClick}
            sx={{ ".MuiDataGrid-cell:hover": { cursor: "pointer" } }}
          />
        </div>
      </Container>
    </div>
  )
}
