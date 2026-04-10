'use client'

export async function initAxe() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const React = (await import('react')).default
    const ReactDOM = (await import('react-dom')).default
    const axe = (await import('@axe-core/react')).default
    axe(React, ReactDOM, 1000)
  }
}
