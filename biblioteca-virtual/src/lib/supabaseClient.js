// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Reemplaza esto con los datos de tu proyecto de Supabase
const supabaseUrl = 'https://gxzbocffvhkqddqohnoo.supabase.co';
const supabaseKey = 'sb_publishable_gjIhUXm0KVpfhpUFhFchhw_84NiHzAS';

export const supabase = createClient(supabaseUrl, supabaseKey);