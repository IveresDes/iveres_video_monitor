import React, { useEffect, useMemo, useState } from 'react'
import {
  Typography, Container, Link, Stack, CircularProgress, Tab, Box, ListItem,
  Tooltip, IconButton, ListItemIcon, ListItemText, ListItemAvatar, Avatar
} from '@mui/material'
import { TabContext, TabList, TabPanel } from '@mui/lab'
import { Info as InfoIcon, Poll as PollIcon } from '@mui/icons-material'
import { useParams, Link as RouterLink } from 'react-router-dom'
import Header from '../components/Header'
import { whisperMediumWer } from '../utils/whisper_info'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'

function formatPercent(num) {
  return Number(num).toLocaleString(
    undefined, { style: 'percent', minimumFractionDigits: 2 }
  )
}

const langOrder = { es: 2, en: 1 }

function AnalysisStatus({ value }) {
  switch (value) {
    case 'waiting':
      return <CircularProgress />
    case 'disabled':
      return <Typography>Deshabilitado en este recurso.</Typography>
    case 'error':
      return <Typography>Error en este recurso.</Typography>
    default:
      return null
  }
}

export default function Media() {
  let { mediaId } = useParams()
  const [media, setMedia] = useState()
  const [currentTab, setCurrentTab] = useState("info") // info, transcription, fake
  const [currentLang, setCurrentLang] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    function updateMedia(mediaId) {
      fetch(`/api/media/${mediaId}`)
        .then(res => res.json())
        .then(data => {
          setMedia(data)
          setCurrentLang(prev => prev || "es")
        })
        .catch(err => console.error(err))
    }
    updateMedia(mediaId)
    let intervalID = setInterval(() => { updateMedia(mediaId) }, 3000)
    return function cleanup() { clearInterval(intervalID) }
  }, [mediaId])

  function handleTabChange(ev, newValue) {
    setCurrentTab(newValue)
  }

  function handleLangTabChange(ev, newValue) {
    setCurrentLang(newValue)
  }

  function handleTimeUpdate(ev) {
    setCurrentTime(ev.currentTarget.currentTime)
  }

  const transcriptionsData = useMemo(() =>
    Object.entries(media?.extractedMetadata?.transcriptions?.data || {})
      .sort(([al, ad], [bl, bd]) => (langOrder[bl] || 0) - (langOrder[al] || 0))
    , [media])

  const trancriptionSegments = useMemo(() =>
    (media?.extractedMetadata?.transcriptions?.data[currentLang]?.segments || [])
      .map((seg, i) =>
        <Typography
          key={`seg-${i}`}
          variant="body1"
          component="span"
          sx={seg.start < currentTime && currentTime < seg.end ? { bgcolor: '#9cf' } : {}}
        >
          {seg.text}
        </Typography>
      )
    , [media, currentLang, currentTime])

  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ width: '100%', marginTop: 20, marginBottom: 20 }}
      >
        <Typography variant="h5" gutterBottom>Multimedia</Typography>
        {media ? (
          <>
            <Container>
              {media.mediaType === "image" ?
                <div
                  style={{ display: "flex", width: "100%", justifyContent: "center" }}
                >
                  {media?.extractedMetadata?.fakes?.segment?.score_image ?
                    <ReactCompareSlider
                      itemOne={
                        <ReactCompareSliderImage
                          src={"/resources/" + media?.path}
                          alt={media?.platformMetadata?.title || ""}
                          style={{ height: "100%", maxHeight: '50vh' }}
                        />
                      }
                      itemTwo={
                        <ReactCompareSliderImage
                          src={"/resources/" + media?.extractedMetadata?.fakes?.segment?.score_image}
                          alt={(media?.platformMetadata?.title || "") + " score"}
                          style={{ height: "100%", maxHeight: '50vh' }}
                        />
                      }
                    /> :
                    <img
                      src={"/resources/" + media?.path}
                      style={{ height: "100%", maxHeight: '50vh' }}
                      alt={media?.platformMetadata?.title || ""}
                    />
                  }
                </div>
                :
                <video
                  controls
                  height="320"
                  style={{ width: "100%", height: "100%", maxHeight: 320 }}
                  onTimeUpdate={handleTimeUpdate}
                >
                  <source src={"/resources/" + media?.path} />
                  {transcriptionsData.map(([lang, transcription], i) =>
                    <track
                      key={lang}
                      label={lang}
                      kind="subtitles"
                      srcLang={lang}
                      src={"/resources/" + transcription?.filesPath?.vtt}
                      default={i === 0}
                    />
                  )}
                </video>
              }
            </Container>
            <TabContext value={currentTab}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <TabList
                  value={currentTab}
                  onChange={handleTabChange}
                  aria-label="pestañas de datos"
                >
                  <Tab label="Información" value="info" />
                  <Tab label="Transcripción" value="transcriptions" />
                  <Tab label="Fakes" value="fake" />
                </TabList>
              </Box>
              <TabPanel value="info">
                <Stack spacing={1}>
                  <Typography variant="subtitle1" color="text.secondary">
                    Estado: {media?.status}
                  </Typography>
                  <Typography variant="h6">{media?.platformMetadata?.title}</Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    {media?.platformMetadata?.uploader} ({media?.platformMetadata?.uploaderId})
                  </Typography>
                  <Typography variant="body1">
                    {(new Date(media?.platformMetadata?.uploadDatetime)).toLocaleString()}
                    {
                      media?.platformMetadata?.modifiedDatetime
                      && ` (Última modificación archivo: ${(new Date(media?.platformMetadata?.modifiedDatetime)).toLocaleString()})`
                    }
                  </Typography>
                  <Typography variant="body1" noWrap>
                    <Link
                      href={media?.platformMetadata?.videoUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {media?.platformMetadata?.videoUrl}
                    </Link>
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {media?.platformMetadata?.description}
                  </Typography>
                </Stack>
              </TabPanel>
              <TabPanel value="transcriptions" >
                <AnalysisStatus value={media?.analysisStatus?.transcribe} />
                {
                  (currentLang && media?.extractedMetadata?.transcriptions) &&
                  <TabContext value={currentLang}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                      <TabList
                        value={currentLang}
                        onChange={handleLangTabChange}
                        aria-label="pestañas de idiomas"
                      >
                        {transcriptionsData.map(([lang, data]) =>
                          <Tab
                            key={lang}
                            label={
                              lang + (
                                lang === media?.extractedMetadata?.transcriptions?.srcLang ?
                                  ' (Original)' : ''
                              )
                            }
                            icon={
                              <Tooltip
                                title={(
                                  lang === media?.extractedMetadata?.transcriptions?.srcLang ?
                                    `Calidad estimada: ${whisperMediumWer[lang]} WER(%)`
                                    :
                                    `Calidad aproximada: ${whisperMediumWer[lang]} WER(%) + error traducción`
                                )}
                                placement="top"
                              >
                                <InfoIcon />
                              </Tooltip>
                            }
                            iconPosition="end"
                            value={lang}
                          />
                        )}
                      </TabList>
                    </Box>
                    {Object.entries(media?.extractedMetadata?.transcriptions?.data)
                      .map(([lang, transcription]) =>
                        <TabPanel key={lang} value={lang} sx={{ paddingX: 0 }}>
                          <Stack spacing={2}>
                            <Link
                              href={`/resources/${transcription?.filesPath?.srt}`}
                              download
                            >
                              Descargar subtítulos (formato SRT)
                            </Link>
                            <Typography variant="body1" align="justify">
                              {trancriptionSegments}
                            </Typography>
                          </Stack>
                        </TabPanel>
                      )
                    }
                  </TabContext>
                }
              </TabPanel>
              <TabPanel value="fake">
                <AnalysisStatus value={media?.analysisStatus?.fake} />
                {media?.mediaType === "image" ?
                  media?.extractedMetadata?.fakes &&
                  Object.entries(media.extractedMetadata.fakes).map(([key, val]) => (
                    <ListItem
                      key={key}
                      secondaryAction={
                        <IconButton component={RouterLink} to="/info"><InfoIcon /></IconButton>
                      }
                    >
                      <ListItemIcon><PollIcon /></ListItemIcon>
                      <ListItemText
                        primary={`${key} (${val.name})`}
                        secondary={`${formatPercent(val.score)} fake`}
                      />
                    </ListItem>
                  ))
                  // <ListItem
                  //   secondaryAction={
                  //     <IconButton component={RouterLink} to="/info"><InfoIcon /></IconButton>
                  //   }
                  // >
                  //   <ListItemIcon><PollIcon /></ListItemIcon>
                  //   <ListItemText
                  //     primary="LDIRE"
                  //     secondary={`${formatPercent(media?.extractedMetadata?.fakes?.ldire?.score)}`}
                  //   />
                  //   <ListItemAvatar>
                  //     <Avatar
                  //       alt={"LDIRE error map"}
                  //       src={`/resources/${media?.extractedMetadata?.fakes?.ldire?.error_map}`}
                  //       sx={{ width: 256, height: 256 }}
                  //       variant="square"
                  //     />
                  //   </ListItemAvatar>
                  // </ListItem>
                  :
                  media?.extractedMetadata?.fakes &&
                  <>
                    <ListItem
                      secondaryAction={
                        <IconButton component={RouterLink} to="/info"><InfoIcon /></IconButton>
                      }
                    >
                      <ListItemIcon><PollIcon /></ListItemIcon>
                      <ListItemText
                        primary="Polimi"
                        secondary={`${formatPercent(media?.extractedMetadata?.fakes?.polimi?.score)} fake`}
                      />
                      <ListItemAvatar>
                        <Avatar
                          alt={"Polimi frames graph"}
                          src={`/resources/${media?.extractedMetadata?.fakes?.polimi?.figure}`}
                          sx={{ width: 256, height: "auto" }}
                          variant="square"
                        />
                      </ListItemAvatar>
                    </ListItem>
                    <ListItem
                      secondaryAction={
                        <IconButton component={RouterLink} to="/info"><InfoIcon /></IconButton>
                      }
                    >
                      <ListItemIcon><PollIcon /></ListItemIcon>
                      <ListItemText
                        primary="Deepware"
                        secondary={`${formatPercent(media?.extractedMetadata?.fakes?.deepware)} fake`}
                      />
                    </ListItem>
                  </>
                }
              </TabPanel>
            </TabContext>
          </>
        ) : (
          <CircularProgress />
        )}
      </Container>
    </div>
  )
}
