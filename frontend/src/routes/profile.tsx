import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useProfile, formatAge } from '../hooks/useProfile'
import type { BabySex } from '../hooks/useProfile'
import { BR } from '../components/br/theme'
import { PageHead } from '../components/br/PageHead'
import { Rule } from '../components/br/Rule'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const navigate = useNavigate()
  const { profile, isLoaded, saveProfile, isSaving } = useProfile()

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthWeight, setBirthWeight] = useState('')
  const [sex, setSex] = useState<BabySex | ''>('')

  useEffect(() => {
    if (isLoaded) {
      setName(profile.baby_name ?? '')
      setBirthDate(profile.birth_date ?? '')
      setBirthWeight(profile.birth_weight ? String(profile.birth_weight) : '')
      setSex(profile.sex ?? '')
    }
  }, [isLoaded, profile])

  const handleSave = async () => {
    await saveProfile({
      baby_name: name.trim() || null,
      birth_date: birthDate || null,
      birth_weight: birthWeight ? parseInt(birthWeight, 10) : null,
      sex: sex || null,
    })
    navigate({ to: '/' })
  }

  const age = formatAge(birthDate)

  if (!isLoaded) {
    return (
      <p
        className="text-center py-12 uppercase"
        style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
      >
        Loading…
      </p>
    )
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 16,
    color: BR.text,
    background: BR.char,
    border: `1px solid ${BR.line}`,
    padding: '12px 14px',
    minHeight: 48,
    letterSpacing: 0.5,
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: BR.amber,
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <>
      <div className="px-5 pt-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: '/' })}
          className="p-2 -ml-2"
          aria-label="Back"
          style={{ color: BR.amber }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 2.5,
            color: BR.dim,
          }}
        >
          ← BACK
        </span>
      </div>

      <PageHead
        kicker="SUBJECT · CONFIG"
        title={<>Profile</>}
        meta={[
          profile.baby_name ? `UNIT ${profile.baby_name.toUpperCase()}` : 'UNIT UNREGISTERED',
          age ? `AGE ${age}` : null,
        ]}
      />

      <Rule label="IDENTITY" />

      <div className="px-5 space-y-5 max-w-md mx-auto">
        <div>
          <label htmlFor="name" style={labelStyle}>
            [ NAME ]
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="enter name"
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="birthDate" style={labelStyle}>
            [ DATE OF BIRTH · DOB ]
          </label>
          <input
            type="date"
            id="birthDate"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            style={inputStyle}
          />
          {age && (
            <p
              className="mt-1.5 uppercase"
              style={{
                fontFamily: BR.mono,
                fontSize: 9,
                letterSpacing: 1.5,
                color: BR.cyan,
                textShadow: `0 0 6px ${BR.cyanGlow}`,
              }}
            >
              › age: {age}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="birthWeight" style={labelStyle}>
            [ BIRTH MASS · GRAMS ]
          </label>
          <div className="relative">
            <input
              type="number"
              id="birthWeight"
              value={birthWeight}
              onChange={(e) => setBirthWeight(e.target.value)}
              placeholder="3500"
              min="500"
              max="6000"
              step="10"
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 uppercase"
              style={{
                fontFamily: BR.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                color: BR.dim,
              }}
            >
              g
            </span>
          </div>
          {birthWeight && (
            <p
              className="mt-1.5"
              style={{
                fontFamily: BR.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: BR.rose,
              }}
            >
              › {(parseInt(birthWeight, 10) / 1000).toFixed(2)} kg
            </p>
          )}
        </div>

        <div>
          <label style={labelStyle}>[ SEX ]</label>
          <div className="flex gap-2">
            {(
              [
                ['boy', 'BOY', BR.cyan],
                ['girl', 'GIRL', BR.rose],
              ] as const
            ).map(([value, label, accent]) => {
              const on = sex === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSex(sex === value ? '' : value)}
                  className="flex-1 uppercase"
                  style={{
                    fontFamily: BR.mono,
                    fontSize: 10,
                    letterSpacing: 2,
                    color: on ? accent : BR.dim,
                    padding: '12px 10px',
                    border: `1px solid ${on ? accent : BR.line}`,
                    background: on ? `${accent}14` : 'transparent',
                    textShadow: on ? `0 0 8px ${accent}88` : 'none',
                    minHeight: 44,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 12,
            letterSpacing: 2,
            color: BR.amber,
            padding: '14px 16px',
            border: `1px solid ${BR.amber}`,
            background: 'rgba(255,179,71,0.12)',
            textShadow: `0 0 10px ${BR.amberGlow}`,
            minHeight: 48,
            opacity: isSaving ? 0.5 : 1,
          }}
        >
          {isSaving ? 'SAVING…' : '[ SAVE · COMMIT ]'}
        </button>
      </div>
    </>
  )
}
