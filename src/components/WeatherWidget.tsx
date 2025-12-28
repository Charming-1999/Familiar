import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CloudSun, RefreshCcw, MapPin } from 'lucide-react'

import { Button } from './Button'

type WeatherData = {
  locationName: string
  weatherText: string
  temperature: number
  apparentTemperature: number
  humidity: number
  windSpeed: number
  updatedAt: number
}

function weatherCodeToText(code: number): string {
  if (code === 0) return '晴'
  if (code === 1) return '大部晴朗'
  if (code === 2) return '多云'
  if (code === 3) return '阴'
  if (code === 45 || code === 48) return '雾'
  if ([51, 53, 55].includes(code)) return '毛毛雨'
  if ([56, 57].includes(code)) return '冻雨（毛毛雨）'
  if ([61, 63, 65].includes(code)) return '降雨'
  if ([66, 67].includes(code)) return '冻雨'
  if ([71, 73, 75].includes(code)) return '降雪'
  if (code === 77) return '雪粒'
  if ([80, 81, 82].includes(code)) return '阵雨'
  if ([85, 86].includes(code)) return '阵雪'
  if (code === 95) return '雷暴'
  if ([96, 99].includes(code)) return '雷暴（冰雹）'
  return `天气码 ${code}`
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=zh`
  const res = await fetch(url)
  if (!res.ok) throw new Error('定位解析失败')
  const json: any = await res.json()

  const parts = [
    json.city || json.locality,
    json.principalSubdivision,
    json.countryName,
  ].filter(Boolean)

  return parts.join(' · ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

async function fetchWeather(lat: number, lon: number): Promise<Omit<WeatherData, 'locationName'>> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code'
  )

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('天气请求失败')
  const json: any = await res.json()

  const cur = json?.current
  if (!cur) throw new Error('天气数据为空')

  const code = Number(cur.weather_code)
  return {
    weatherText: weatherCodeToText(code),
    temperature: Number(cur.temperature_2m),
    apparentTemperature: Number(cur.apparent_temperature),
    humidity: Number(cur.relative_humidity_2m),
    windSpeed: Number(cur.wind_speed_10m),
    updatedAt: Date.now(),
  }
}

export const WeatherWidget: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inFlightRef = useRef(0)

  const load = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('当前浏览器不支持定位')
      return
    }

    const reqId = ++inFlightRef.current
    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const [locName, w] = await Promise.all([
            reverseGeocode(latitude, longitude).catch(() => `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`),
            fetchWeather(latitude, longitude),
          ])

          if (inFlightRef.current !== reqId) return

          setData({
            locationName: locName,
            ...w,
          })
        } catch (e: any) {
          if (inFlightRef.current !== reqId) return
          setError(e?.message || '获取失败')
        } finally {
          if (inFlightRef.current === reqId) setLoading(false)
        }
      },
      (err) => {
        if (inFlightRef.current !== reqId) return
        setLoading(false)
        if (err?.code === 1) setError('需要定位授权才能获取当地天气')
        else setError('获取定位失败')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 2 * 60 * 1000 }
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updatedText = useMemo(() => {
    if (!data?.updatedAt) return ''
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(data.updatedAt))
  }, [data?.updatedAt])

  if (compact) {
    return (
      <div className="glass-card px-3 py-2 rounded-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CloudSun className="w-4 h-4 text-primary" />
            <div className="text-xs font-semibold text-foreground">气候</div>
          </div>
          <button
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-background/20 hover:bg-muted/30"
            onClick={load}
            disabled={loading}
            title="刷新"
          >
            <RefreshCcw className={loading ? 'w-4 h-4 animate-spin text-muted-foreground' : 'w-4 h-4 text-muted-foreground'} />
          </button>
        </div>

        {error ? (
          <div className="mt-2 text-[11px] text-red-400">{error}</div>
        ) : !data ? (
          <div className="mt-2 text-[11px] text-muted-foreground">{loading ? '获取中...' : '暂无数据'}</div>
        ) : (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="text-[11px] text-muted-foreground truncate">{data.locationName}</div>
              <div className="ml-auto text-[10px] text-muted-foreground">{updatedText}</div>
            </div>

            <div className="flex items-end justify-between">
              <div className="text-xl font-bold text-foreground">{Math.round(data.temperature)}°C</div>
              <div className="text-[11px] text-muted-foreground truncate">{data.weatherText} · 体感 {Math.round(data.apparentTemperature)}°C</div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              湿度 {Math.round(data.humidity)}% · 风速 {Math.round(data.windSpeed)} km/h
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-4 rounded-xl border-primary/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CloudSun className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">气候</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="space-x-1">
            <RefreshCcw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
            <span>刷新</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 text-xs text-red-400">{error}</div>
      ) : !data ? (
        <div className="mt-3 text-xs text-muted-foreground">{loading ? '获取中...' : '暂无数据'}</div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="text-xs text-muted-foreground truncate">{data.locationName}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">更新 {updatedText}</div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">{Math.round(data.temperature)}°C</div>
              <div className="text-xs text-muted-foreground">{data.weatherText}</div>
            </div>
            <div className="text-xs text-muted-foreground">体感 {Math.round(data.apparentTemperature)}°C</div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-background/30 p-2">
              <div className="text-muted-foreground">湿度</div>
              <div className="mt-1 font-semibold text-foreground">{Math.round(data.humidity)}%</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/30 p-2">
              <div className="text-muted-foreground">风速</div>
              <div className="mt-1 font-semibold text-foreground">{Math.round(data.windSpeed)} km/h</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/30 p-2">
              <div className="text-muted-foreground">定位</div>
              <div className="mt-1 font-semibold text-foreground">已开启</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
