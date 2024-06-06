import { Container, Typography } from '@mui/material'
import React from 'react'
import Header from '../components/Header'

export default function Home() {
  return (
    <div>
      <Header />
      <Container
        maxWidth="lg"
        component="main"
        style={{ height: 500, width: '100%', marginTop: 20, marginBottom: 20 }}
      >
        <Typography variant="h5" gutterBottom>Iveres</Typography>
        <Typography variant="body1" gutterBottom>
          El proyecto IVERES nace con la voluntad de crear una herramienta de inteligencia artificial que nos ayude a detectar informaciones falsas IVERES “Identificación, Verificación y Respuesta. El estado democrático ante el reto de la desinformación interesada”.
        </Typography>
        <Typography variant="body1">
          Es un proyecto financiado por el Ministerio de Ciencia e Innovación perteneciente a la convocatoria de 2021, Proyectos de I+D+I en líneas estratégicas, en colaboración público-privada, del programa estatal de I+D+I orientada a los retos de la sociedad en el marco del plan estatal de investigación científica y técnica y de innovación 2017-2020.
        </Typography>
        <br />
        <Typography variant="h5" gutterBottom>Herramienta de monitorización</Typography>
        <Typography variant="body1" gutterBottom>
          Los canales de desinformación son numerosos y generan muchos videos. Esto dificulta que los equipos de verificación puedan seguir su evolución, revisar el contenido y desmentir los datos que sean necesarios.
        </Typography>
        <Typography variant="body1">
          Esta herramienta es una ayuda en este sentido que permite monitorizar automáticamente canales de YouTube y TikTok para descargar sus vídeos, almacenar metadatos básicos y generar transcripciones en su idioma original, español e inglés. También se pueden subir individualmente videos de redes sociales o archivos con las mismas opciones además de un análisis adicional de fakes.
        </Typography>
      </Container>
    </div>
  )
}
