import React, { createContext, useCallback, useEffect, useState } from 'react'

const initAuthState = { isLoaded: false, username: null, role: null }

const AuthContext = createContext(initAuthState)

function AuthProvider(props) {
  const [authState, setAuthState] = useState(initAuthState)

  const getUser = useCallback(() => {
    return new Promise((resolve, reject) => {
      fetch('/auth/user')
        .then(res => res.json())
        .then(data => {
          if (data.username) {
            setAuthState(
              { isLoaded: true, username: data.username, role: data.role }
            )
            resolve()
          } else {
            setAuthState({ ...initAuthState, isLoaded: true })
            reject()
          }
        })
        .catch(err => {
          console.error(err)
          setAuthState({ ...initAuthState, isLoaded: true })
          reject()
        })
    })
  }, [])

  useEffect(() => {
    getUser()
      .then(res => {
        console.debug("user loaded")
      }).catch(err => {
        console.debug("user error")
      })
  }, [getUser])

  function doLogin(username, password) {
    return new Promise((resolve, reject) => {
      const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }
      fetch('/auth/login', init)
        .then(res => res.json())
        .then(data => getUser())
        .then(() => {
          console.debug("user loaded")
          resolve()
        })
        .catch(err => {
          console.debug(err)
          reject()
        })
    })
  }

  function doLogout() {
    return new Promise((resolve, reject) => {
      if (!authState.username) {
        resolve()
        return
      }
      fetch('/auth/logout', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          setAuthState({ ...initAuthState, isLoaded: true })
          resolve()
        })
        .catch(err => {
          console.error(err)
          reject()
        })
    })
  }

  return (
    <AuthContext.Provider value={{ authState, doLogin, doLogout }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export { AuthProvider, AuthContext }
