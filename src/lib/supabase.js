import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ttjrzmegmpavhthrvrzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0anJ6bWVnbXBhdmh0aHJ2cnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTc3OTUsImV4cCI6MjA4OTY3Mzc5NX0.ZEAY5O7i_tBd3PhNlYD42GINnEU6ta27gZCP6N3DNhA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
