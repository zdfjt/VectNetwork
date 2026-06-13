"use client"

import { useSyncExternalStore } from "react"

const STORAGE_KEY = "propamm.customRpcUrl"

let memoryValue: string | null = null
let initialized = false

const listeners = new Set<() => void>()

function init() {
  if (initialized) return
  initialized = true
  if (typeof window !== "undefined") {
    try {
      memoryValue = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      memoryValue = null
    }
  }
}

function emit() {
  for (const l of listeners) l()
}

/** Persist (or clear) the user's custom RPC URL and notify subscribers. */
export function setCustomRpcUrl(url: string | null) {
  init()
  const next = url && url.trim() ? url.trim() : null
  memoryValue = next
  if (typeof window !== "undefined") {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
  emit()
}

export function getCustomRpcUrl(): string | null {
  init()
  return memoryValue
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Reactive hook: re-renders whenever the stored custom RPC URL changes. */
export function useCustomRpcUrl(): string | null {
  return useSyncExternalStore(subscribe, getCustomRpcUrl, () => null)
}
