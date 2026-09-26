/**
 * owlcms Ingestion Integration — Standalone Example Script
 * 
 * Usage:
 *   node example_upload.js <path-to-owlcms-export.json>
 *
 * Requirements:
 *   Node.js v18+ (uses native global fetch)
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://owlanalytics.org';

function extractMeetFacts(json) {
  const comp = json.competition || {};
  const athletes = json.athletes || json.competitors || [];
  const teams = json.teams || [];

  return {
    competition_name: (
      comp.competitionName ||
      comp.name ||
      json.competitionName ||
      'Unnamed Competition'
    ).trim(),
    competition_date: (
      comp.competitionDate ||
      comp.localizedCompetitionDate ||
      json.startDate ||
      null
    ),
    competition_site: (
      comp.competitionSite ||
      json.venue ||
      ''
    ).trim(),
    city_text: (comp.competitionCity || json.city || null)?.trim(),
    host_country_text: (comp.country || json.country || null)?.trim(),
    organizer_text: (
      comp.competitionOrganizer ||
      json.competitionOrganizer ||
      null
    )?.trim(),
    federation_text: (
      comp.federation ||
      comp.sanctioningFederation ||
      json.federation ||
      null
    )?.trim(),
    athlete_countries: Array.from(new Set(
      athletes
        .map(a => (a.country || a.nation || a.fed || '').trim().toUpperCase())
        .filter(c => c.length === 3)
    )),
    team_names: Array.from(new Set(
      teams.map(t => (t.name || t.code || '').trim()).filter(Boolean)
    ))
  };
}

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Error: Please provide path to an owlcms JSON file.');
    console.error('Usage: node example_upload.js <path-to-owlcms-export.json>');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at "${absolutePath}"`);
    process.exit(1);
  }

  console.log(`\nReading owlcms export file: ${path.basename(absolutePath)}...`);
  const rawContent = fs.readFileSync(absolutePath, 'utf-8');
  const meetJson = JSON.parse(rawContent);

  // Step 1: Extract meet facts
  const meetFacts = extractMeetFacts(meetJson);
  console.log('Extracted Meet Facts:');
  console.log(`  Name:      ${meetFacts.competition_name}`);
  console.log(`  Date:      ${meetFacts.competition_date || 'N/A'}`);
  console.log(`  Venue:     ${meetFacts.competition_site || 'N/A'}`);
  console.log(`  Organizer: ${meetFacts.organizer_text || 'N/A'}`);
  console.log(`  Countries: ${meetFacts.athlete_countries.join(', ') || 'N/A'}`);
  console.log(`  Teams:     ${meetFacts.team_names.length} teams detected`);

  // Step 2: Call the Resolver API
  console.log(`\nCalling Resolver API: ${BASE_URL}/api/federations/resolve...`);
  const resolveRes = await fetch(`${BASE_URL}/api/federations/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meetFacts)
  });

  if (!resolveRes.ok) {
    const errText = await resolveRes.text();
    console.error(`Resolver failed with HTTP ${resolveRes.status}:`, errText);
    process.exit(1);
  }

  const resolution = await resolveRes.json();
  console.log('Resolution Result:');
  console.log(`  Scope:        ${resolution.suggested_scope} (${resolution.scope_inference_source || 'defaulted'})`);
  console.log(`  Host Country: ${resolution.host_country?.match?.canonical_name || 'Unresolved'} (${resolution.host_country?.match?.country_code || 'N/A'})`);
  if (resolution.inferred_international_federation) {
    console.log(`  Tier 1 Apex:  ${resolution.inferred_international_federation.canonical_name} (${resolution.inferred_international_federation.short_code})`);
  }
  if (resolution.inferred_continental_federation) {
    console.log(`  Tier 2 Cont:  ${resolution.inferred_continental_federation.canonical_name} (${resolution.inferred_continental_federation.short_code})`);
  }
  if (resolution.inferred_regional_federation) {
    console.log(`  Tier 3 Reg:   ${resolution.inferred_regional_federation.canonical_name} (${resolution.inferred_regional_federation.short_code})`);
  }
  if (resolution.inferred_national_federation) {
    console.log(`  Tier 4 Nat:   ${resolution.inferred_national_federation.canonical_name} (${resolution.inferred_national_federation.short_code})`);
  }
  if (resolution.inferred_regional_federation && resolution.inferred_regional_federation.level === 'regional_state_wso') {
    console.log(`  Tier 5 Prov:  ${resolution.inferred_regional_federation.canonical_name} (${resolution.inferred_regional_federation.short_code})`);
  }

  // Step 3: Call the Upload API in Dry-Run (Simulation) Mode
  console.log(`\nCalling Upload API in Dry-Run Mode: ${BASE_URL}/api/owlcms/upload...`);
  const uploadRes = await fetch(`${BASE_URL}/api/owlcms/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Submitter-Name': 'Integration Test Runner',
      'X-Submitter-Email': 'integration@owlanalytics.org',
      'X-Dry-Run': 'true',
      'X-File-Name': path.basename(absolutePath)
    },
    body: rawContent
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error(`Upload test failed with HTTP ${uploadRes.status}:`, errText);
    process.exit(1);
  }

  const uploadResult = await uploadRes.json();
  console.log('Upload Simulation Result:');
  console.log(`  Success:    ${uploadResult.success}`);
  console.log(`  Dry Run:    ${uploadResult.dryRun}`);
  console.log(`  Athletes:   ${uploadResult.athletes_found || uploadResult.athletesProcessed || 0} processed`);
  console.log(`  Status:     ${uploadResult.status || 'OK'}`);
  console.log(`\nIntegration pipeline completed successfully!`);
}

run().catch((err) => {
  console.error('Unhandled error during integration run:', err);
  process.exit(1);
});
