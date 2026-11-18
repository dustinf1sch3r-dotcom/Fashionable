import { useLocalSearchParams } from 'expo-router';
import { CalendarDayScreen } from '@/features/calendar';

export default function CalendarDayRoute() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return <CalendarDayScreen date={date} />;
}
