import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting GTFS cron import job...')

    // 1. Récupérer toutes les configurations actives
    const { data: configs, error: configError } = await supabase
      .from('gtfs_import_configs')
      .select('*')
      .eq('auto_import_enabled', true)

    if (configError) {
      throw new Error(`Error fetching configs: ${configError.message}`)
    }

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active auto-import configurations found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${configs.length} active configurations`)

    const results = []
    let successCount = 0
    let errorCount = 0

    // 2. Traiter chaque configuration
    for (const config of configs) {
      try {
        console.log(`Processing network: ${config.network_id}`)

        // Vérifier si un import est nécessaire
        const lastImport = config.last_import_date ? new Date(config.last_import_date) : null
        const now = new Date()
        const hoursSinceLastImport = lastImport ? 
          (now.getTime() - lastImport.getTime()) / (1000 * 60 * 60) : 
          Infinity

        if (hoursSinceLastImport < config.import_interval_hours) {
          console.log(`Skipping ${config.network_id}: last import was ${Math.round(hoursSinceLastImport)} hours ago`)
          results.push({
            network_id: config.network_id,
            status: 'skipped',
            reason: `Last import was ${Math.round(hoursSinceLastImport)} hours ago`,
            next_import_in_hours: config.import_interval_hours - hoursSinceLastImport
          })
          continue
        }

        // Appeler la fonction d'import automatique
        const importResponse = await fetch(`${supabaseUrl}/functions/v1/auto-gtfs-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            network_id: config.network_id,
            force_import: false
          })
        })

        const importResult = await importResponse.json()

        if (importResult.success) {
          successCount++
          results.push({
            network_id: config.network_id,
            status: 'success',
            message: importResult.message,
            import_result: importResult.import_result
          })
          console.log(`✅ Successfully imported ${config.network_id}`)
        } else {
          errorCount++
          results.push({
            network_id: config.network_id,
            status: 'error',
            error: importResult.error
          })
          console.error(`❌ Failed to import ${config.network_id}: ${importResult.error}`)
        }

      } catch (error) {
        errorCount++
        results.push({
          network_id: config.network_id,
          status: 'error',
          error: error.message
        })
        console.error(`❌ Error processing ${config.network_id}:`, error)
      }
    }

    // 3. Enregistrer le résultat du job cron
    const cronResult = {
      timestamp: new Date().toISOString(),
      total_configs: configs.length,
      success_count: successCount,
      error_count: errorCount,
      results: results
    }

    // Optionnel: sauvegarder les résultats dans une table de logs
    try {
      await supabase
        .from('gtfs_cron_logs')
        .insert([cronResult])
    } catch (logError) {
      console.warn('Failed to save cron log:', logError)
      // Ne pas faire échouer le job si on ne peut pas sauvegarder le log
    }

    console.log(`GTFS cron job completed: ${successCount} success, ${errorCount} errors`)

    return new Response(JSON.stringify({
      success: true,
      message: `GTFS cron job completed`,
      ...cronResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in GTFS cron job:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

console.log('Function "cron-gtfs-import" up and running!') 