import {
  Button, Card, CardActions, CardContent, Checkbox, CircularProgress, Container,
  FormControlLabel, FormGroup, Grid, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography
} from '@mui/material'
import React, { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Header from '../components/Header'

const acceptedTypes = ['video', 'audio', 'image'] // accept: "video/*,audio/*,image/*"
const maxFileSizeMB = 500

export default function Upload() {
  // uploadResult = {name, requestId, mediaId}
  const [uploadResults, setUploadResults] = useState([])
  const [uploadMethod, setUploadMethod] = useState('request') // request, media
  const [errorMessage, setErrorMessage] = useState('')
  const [disabledOptions, setDisabledOptions] = useState({ transcription: false, fake: false })

  function validateFile(file) {
    // Check accepted type
    const isAcceptedType = acceptedTypes.some(acceptedType => file.type.match(acceptedType))
    if (!isAcceptedType) {
      setErrorMessage(
        `El formato "${file.type}" no está acceptado.
         Selecciona un archivo con formato: ${acceptedTypes.join(', ')}.`
      )
      return false
    }
    // Check file size
    const fileMb = file.size / 1024 ** 2
    if (fileMb > maxFileSizeMB) {
      setErrorMessage(`El tamaño del archivo ${Math.round(fileMb)}MB supera el limite de ${maxFileSizeMB}MB`)
      return false
    }
    return true
  }

  function onFileChange(ev) {
    setErrorMessage('')
    const file = ev.target.files[0]
    if (!file) return
    // Validate file
    validateFile(file)
    // Disable options according to media type
    const mediaType = acceptedTypes.find(acceptedType => file.type.match(acceptedType))
    setDisabledOptions({ transcription: mediaType === 'image', fake: mediaType === 'audio' })
  }

  function handleSubmitUpload(ev) {
    ev.preventDefault()

    const form = ev.target
    const formData = new FormData(form)

    const file = formData.get('file')
    if (file) {
      const isValid = validateFile(file)
      if (!isValid) return
      const mediaType = acceptedTypes.find(acceptedType => file.type.match(acceptedType))
      formData.set('mediaType', mediaType.split("/")[0])
      formData.set('modifiedDate', file.lastModified)
    }

    // Display request
    const uploadResult = { name: file?.name || formData.get('link'), mediaId: null }
    setUploadResults(prev => [...prev, uploadResult])

    const init = { method: form.method, body: formData }
    fetch(`/api/${uploadMethod}`, init)
      .then(res => res.json())
      .then(data => {
        setUploadResults(prev => prev.map(u => u.name === data.name ? data : u))
      })
      .catch(err => console.error(err))

    setErrorMessage('')
    // Only reset text and file fields of the form, not checkbox options
    Array.from(form.elements).forEach(el => {
      if (el.type === "text" || el.type === "file") { el.value = "" }
    })
  }

  function handleUplaodMethodChange(ev, newValue) {
    setUploadMethod(newValue)
    setErrorMessage('')
    setDisabledOptions({ transcription: false, fake: false })
  }

  function updatedResultsPromise(uploadResults) {
    return Promise.all(
      uploadResults.map(uploadResult => new Promise((resolve, reject) => {
        if (uploadResult.requestId && !uploadResult.mediaId) {
          fetch(`/api/request/${uploadResult.requestId}`)
            .then(res => res.json())
            .then(data => {
              resolve({ ...uploadResult, mediaId: data.videoId })
            })
            .catch(err => {
              console.error(err)
              resolve(uploadResult)
            })
        } else {
          resolve(uploadResult)
        }
      }))
    )
  }

  useEffect(() => {
    let intervalID = setInterval(() => {
      updatedResultsPromise(uploadResults)
        .then(updatedUploadResults => {
          setUploadResults(updatedUploadResults)
        })
        .catch(err => console.error(err))
    }, 3000)
    return () => { clearInterval(intervalID) }
  }, [uploadResults])

  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ width: "100%", marginTop: 20, marginBottom: 20 }}
      >
        <Grid
          item
          xs={12}
          container
          spacing={2}
        >
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>Cargar</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body1">Carga recursos multimedia desde un enlace (video o audio de múltiples plataformas, principalmente YouTube y TikTok) o un archivo (video, audio o imagen) y selecciona si quieres hacer una transcripción (video o audio) o detectar fakes (video, imagen). Junto con los archivos puedes añadir metadatos opcionales de título y canal que se mostrarán en la interfaz. También puedes hacer múltiples peticiones que se mostrarán abajo.</Typography>
          </Grid>
          <Grid container item xs={12} justifyContent="center">
            <ToggleButtonGroup
              color="primary"
              value={uploadMethod}
              exclusive
              onChange={handleUplaodMethodChange}
              aria-label="Método de subida"
            >
              <ToggleButton value="request">Enlace</ToggleButton>
              <ToggleButton value="media">Archivo</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          <Grid
            container
            item
            xs={12}
            spacing={2}
            component="form"
            autoComplete="off"
            method="post"
            encType="multipart/form-data"
            onSubmit={handleSubmitUpload}
          >
            <Grid item xs={12}>
              <Typography variant="body1" color="error">
                {errorMessage}
              </Typography>
            </Grid>
            {uploadMethod === "request" ?
              <Grid item xs={12}>
                <TextField
                  variant="outlined"
                  fullWidth
                  placeholder="https://www.plataforma.com/@ejemplo/video/123456"
                  name="link"
                  required
                />
              </Grid>
              :
              <>
                <Grid item xs={12}>
                  <TextField
                    inputProps={{ accept: "video/*,audio/*,image/*" }}
                    fullWidth
                    type="file"
                    name="file"
                    required
                    onChange={onFileChange}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Título (Opcional)" name="title" fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Canal (Opcional)" name="channel" fullWidth />
                </Grid>
              </>
            }
            <Grid item xs={12}>
              <FormGroup row>
                <FormControlLabel
                  control={<Checkbox defaultChecked />}
                  label="Transcripción"
                  name="transcription"
                  disabled={disabledOptions.transcription}
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="Detección fake"
                  name="fake"
                  disabled={disabledOptions.fake}
                />
              </FormGroup>
            </Grid>
            <Grid container item xs={12} justifyContent="center">
              <Button variant="contained" type="submit">Cargar</Button>
            </Grid>
          </Grid>
        </Grid>
        <Grid item container xs={12} spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>Peticiones</Typography>
            <Typography variant="body1">Cuando el recurso esté accesible aparecerá un enlace para verlo pero los resultados de transcripción y fakes tardarán un tiempo en procesarse. Puedes hacer click para ir a la página o copiar el enlace con el botón derecho para ir en otro momento. Las cargas también estarán siempre accesibles desde la página de Lista.</Typography>
          </Grid>
          <Grid item xs={12}>
            <Container>
              <Stack spacing={2}>
                {uploadResults.map((uploadResult, i) =>
                  <Card
                    key={uploadResult.name + i}
                    variant="outlined"
                  >
                    <CardContent>
                      <Typography variant="body1">
                        {uploadResult.name}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      {uploadResult.mediaId ?
                        <Button
                          component={RouterLink}
                          to={`/media/${uploadResult.mediaId}`}
                          color="secondary"
                          variant="outlined"
                        >
                          {`/media/${uploadResult.mediaId}`}
                        </Button>
                        :
                        <CircularProgress color="secondary" size={30} />
                      }
                    </CardActions>
                  </Card>
                )}
              </Stack>
            </Container>
          </Grid>
        </Grid>
      </Container>
    </div>
  )
}
