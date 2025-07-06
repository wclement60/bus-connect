# Script pour supprimer les console.log des fichiers de l'application
param (
    [string[]]$FilesToProcess = @(
        "src\components\Timetable.js",
        "src\services\realtime.js",
        "src\services\supabase.js"
    )
)

foreach ($filePath in $FilesToProcess) {
    Write-Host "Traitement du fichier $filePath..."
    
    if (Test-Path $filePath) {
        $content = Get-Content -Path $filePath -Raw

        # Commentons les console.log simples (une ligne)
        $content = $content -replace 'console\.log\((.*?)\);', '// console.log($1);'
        $content = $content -replace 'console\.error\((.*?)\);', '// console.error($1);'
        $content = $content -replace 'console\.warn\((.*?)\);', '// console.warn($1);'
        $content = $content -replace 'console\.debug\((.*?)\);', '// console.debug($1);'
        
        # Commentons les console.log multi-lignes 
        $content = $content -replace 'console\.log\(([^;]*){([\s\S]*?)}\);', '/* console.log($1{$2}); */'
        
        # Sauvegarder le fichier
        $content | Set-Content -Path $filePath

        Write-Host "✅ Les console.log, console.error, console.warn et console.debug ont été commentés dans $filePath"
    } else {
        Write-Host "❌ Le fichier $filePath n'existe pas"
    }
}

Write-Host "`nUsage: .\remove-debug.ps1 [chemin1\fichier1.js] [chemin2\fichier2.js] ..."
Write-Host "Si aucun fichier n'est spécifié, les fichiers par défaut seront traités."
Write-Host "`nOpération terminée" 