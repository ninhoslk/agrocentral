import { useQuery } from '@tanstack/react-query'
import { getWeather } from '@/services/providers/weather'

export function useWeather(farmId: string | null | undefined) {
  return useQuery({
    queryKey: ['weather', farmId],
    enabled: !!farmId,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: () => getWeather(farmId!),
  })
}

