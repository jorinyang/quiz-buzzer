// =====================================================
// useScoreboard Hook — 管理实时排行/分数
// =====================================================
'use client'

import { useState, useCallback } from 'react'

export interface TeamScoreEntry {
  teamId: string
  teamName: string
  score: number
}

export interface PlayerScore {
  playerId: string
  playerName: string
  score: number
  teamId: string
}

export function useScoreboard(initialTeams: TeamScoreEntry[] = []) {
  const [rankings, setRankings] = useState<TeamScoreEntry[]>(initialTeams)
  const [playerScores, setPlayerScores] = useState<Map<string, PlayerScore>>(new Map())

  const updateScore = useCallback((playerId: string, teamId: string, scoreChange: number) => {
    setPlayerScores((prev: Map<string, PlayerScore>) => {
      const next = new Map(prev)
      const current = next.get(playerId)
      next.set(playerId, {
        playerId,
        playerName: current?.playerName ?? '',
        score: (current?.score ?? 0) + scoreChange,
        teamId,
      })
      return next
    })

    setRankings((prev: TeamScoreEntry[]) =>
      prev
        .map((t: TeamScoreEntry) => (t.teamId === teamId ? { ...t, score: t.score + scoreChange } : t))
        .sort((a: TeamScoreEntry, b: TeamScoreEntry) => b.score - a.score)
    )
  }, [])

  const setRankingsFromServer = useCallback((data: TeamScoreEntry[]) => {
    setRankings(data.sort((a: TeamScoreEntry, b: TeamScoreEntry) => b.score - a.score))
  }, [])

  return { rankings, playerScores, updateScore, setRankings: setRankingsFromServer }
}
