import { Container, Link, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material'
import React from 'react'
import Header from '../components/Header'

export default function Info() {
  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ height: 500, width: '100%', marginTop: 20, marginBottom: 20 }}
      >
        <Typography variant="h5" gutterBottom>Información</Typography>
        <Typography variant="h6" gutterBottom>Software</Typography>
        <Stack spacing={1}>
          <Paper sx={{ "padding": 2 }}>
            <Typography variant="subtitle2">Transcripción</Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Faster Whisper"
                  secondary={<Link href="https://github.com/SYSTRAN/faster-whisper" >https://github.com/SYSTRAN/faster-whisper</Link>}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Traducción automática"
                  secondary={<Link href="https://github.com/Helsinki-NLP/Opus-MT" >https://github.com/Helsinki-NLP/Opus-MT</Link>}
                />
              </ListItem>
            </List>
          </Paper>
          <Paper sx={{ "padding": 2 }}>
            <Typography variant="subtitle2">Detección de fakes en video</Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Video Face Manipulation Detection Through Ensemble of CNNs (Polimi)"
                  secondary={<Link href="https://github.com/polimi-ispl/icpr2020dfdc" >https://github.com/polimi-ispl/icpr2020dfdc</Link>}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Deepware Scanner (CLI)"
                  secondary={<Link href="https://github.com/Hook35/deepfake-scanner" >https://github.com/Hook35/deepfake-scanner</Link>}
                />
              </ListItem>
            </List>
          </Paper>
          <Paper sx={{ "padding": 2 }}>
            <Typography variant="subtitle2">Detección de fakes en imagen</Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Organika"
                  secondary={<Link href="https://huggingface.co/Organika/sdxl-detector" >https://huggingface.co/Organika/sdxl-detector</Link>}
                />
              </ListItem>
            </List>
          </Paper>
        </Stack>
      </Container>
    </div>
  )
}
