import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// --- Helper Functions ---

function slugToClubNamePattern(slug: string): string {
    const words = slug.split('-').filter(w => w.length > 0)
    return '%' + words.join('%') + '%'
}

function calculateAge(birthYear: number | null): number | null {
    if (!birthYear) return null
    const currentYear = new Date().getFullYear()
    return currentYear - birthYear
}

// 5-year age buckets
function getAgeBucket(age: number): string {
    if (age < 15) return 'Under 15'
    if (age >= 100) return '100+'

    const start = Math.floor(age / 5) * 5
    const end = start + 4
    return `${start}-${end}`
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params

        // 1. Find the club first (reuse logic from main club route)
        const words = slug.split('-').filter(w => w.length > 0)
        const processedWords = words.map(word => {
            if (word.length === 2) return word.split('').join('%')
            return word
        })
        const simplePattern = processedWords.join('%')

        const { data: clubsData, error: clubsError } = await supabaseAdmin
            .from('usaw_clubs')
            .select('club_name')
            .ilike('club_name', `%${simplePattern}%`)
            .limit(10)

        if (clubsError || !clubsData || clubsData.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 })
        }

        // Determine best match (exact slug match logic)
        const targetSlug = slug.toLowerCase()
        let bestMatch = clubsData[0]

        // Exact match check
        const exactMatch = clubsData.find(club => {
            const clubSlug = (club.club_name || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
            return clubSlug === targetSlug
        })

        if (exactMatch) bestMatch = exactMatch
        // (Skipping complex similarity logic for brevity, relying on ilike + simple select for now)

        const clubName = bestMatch.club_name

        // 2. Fetch Club Results & Demographics (Last 24 months for relevance)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const dateStr = twoYearsAgo.toISOString().split('T')[0];

        // Join with usaw_lifters to get birth_year/gender if not in results
        // Note: usaw_meet_results has gender and competition_age usually populated
        const { data: results, error: resultsError } = await supabaseAdmin
            .from('usaw_meet_results')
            .select('gender, competition_age, meet_name, date, meet_id, total')
            .eq('club_name', clubName)
            .gte('date', dateStr)

        if (resultsError) throw resultsError

        // 3. Aggregate Demographics
        const genderCounts: Record<string, number> = { M: 0, F: 0 }
        const ageCounts: Record<string, number> = {}
        const meetsAttended = new Set<string>()

        let totalEntries = 0
        let totalAgeEntries = 0

        results.forEach(r => {
            // Gender
            if (r.gender === 'M' || r.gender === 'F') {
                genderCounts[r.gender]++
                totalEntries++
            }

            // Age
            if (r.competition_age) {
                const bucket = getAgeBucket(r.competition_age)
                ageCounts[bucket] = (ageCounts[bucket] || 0) + 1
                totalAgeEntries++
            }

            // Meets (for Map Spokes)
            // Use meet_id if available, otherwise name-date key
            const meetKey = r.meet_id ? String(r.meet_id) : `${r.meet_name}|${r.date}`
            meetsAttended.add(meetKey)
        })

        // Calculate Percentages
        const genderDist: { name: string, value: number }[] = [
            { name: 'Male', value: totalEntries ? (genderCounts.M / totalEntries) * 100 : 0 },
            { name: 'Female', value: totalEntries ? (genderCounts.F / totalEntries) * 100 : 0 }
        ]

        const ageDist = Object.entries(ageCounts)
            .map(([range, count]) => ({
                range,
                count,
                percentage: totalAgeEntries ? (count / totalAgeEntries) * 100 : 0
            }))
            // Sort age ranges
            .sort((a, b) => {
                const getStartAge = (range: string) => {
                    if (range === 'Under 15') return 0
                    if (range === '100+') return 100
                    return parseInt(range.split('-')[0])
                }
                return getStartAge(a.range) - getStartAge(b.range)
            })

        // 4. Competition Reach (Map Data)
        // We need lat/lng for these meets.
        // Fetch unique meets details
        const uniqueMeetIds = Array.from(meetsAttended).filter(m => !m.includes('|')).map(m => parseInt(m))
        console.log(`[Demographics] Found ${uniqueMeetIds.length} unique meet IDs from ${results.length} results. IDs:`, uniqueMeetIds.slice(0, 5))
        if (results.length > 0) {
            console.log('[Demographics] Sample result row:', JSON.stringify(results[0], null, 2))
        }

        let spokes: any[] = []

        if (uniqueMeetIds.length > 0) {
            // Strategy: Try usaw_meets first (primary specific location), then usaw_meet_locations

            // 1. Fetch from usaw_meets (Check for lat/lng on the meet row itself)
            // 'usaw_meets' uses 'Meet' for the name, not 'meet_name'.
            const { data: meetsData, error: meetsError } = await supabaseAdmin
                .from('usaw_meets')
                .select('meet_id, latitude, longitude, city, state, Meet')
                .in('meet_id', uniqueMeetIds)
                .not('latitude', 'is', null)

            if (meetsError) console.error('[Demographics] Error fetching usaw_meets:', meetsError)

            const foundMeetIds = new Set<number>()

            if (meetsData) {
                meetsData.forEach(m => {
                    spokes.push({
                        name: m.Meet || m.city || 'Unknown Meet',
                        lat: m.latitude,
                        lng: m.longitude,
                        count: results.filter(r => r.meet_id === m.meet_id).length,
                        meet_id: m.meet_id
                    })
                    foundMeetIds.add(m.meet_id)
                })
            }

            // 2. Find missing IDs to try usaw_meet_locations
            const missingIds = uniqueMeetIds.filter(id => !foundMeetIds.has(id))

            if (missingIds.length > 0) {
                // columns: meet_id, latitude, longitude, meet_name, city, state, raw_address
                const { data: locData, error: locError } = await supabaseAdmin
                    .from('usaw_meet_locations')
                    .select('meet_id, latitude, longitude, city, state, meet_name, raw_address')
                    .in('meet_id', missingIds)
                    .not('latitude', 'is', null)

                if (locError) console.error('[Demographics] Error fetching usaw_meet_locations:', locError)

                if (locData) {
                    locData.forEach(l => {
                        spokes.push({
                            name: l.meet_name || l.city || 'Unknown Location',
                            lat: l.latitude,
                            lng: l.longitude,
                            count: results.filter(r => r.meet_id === l.meet_id).length,
                            meet_id: l.meet_id
                        })
                    })
                }
            }
        } else {
            console.log('[Demographics] No valid meet IDs found in results.')
        }

        // 5. Average Club Metrics (National Average)
        // Hardcoded static values based on ~45k recent records for stability and performance.
        // calculated on 2026-01-28
        const avgGenderDist = [
            { name: 'Male', value: 48.0 },
            { name: 'Female', value: 52.0 }
        ]

        const avgAgeDist = [
            { range: 'Under 15', percentage: 11.9 },
            { range: '15-19', percentage: 16.8 },
            { range: '20-24', percentage: 13.4 },
            { range: '25-29', percentage: 14.3 },
            { range: '30-34', percentage: 12.1 },
            { range: '35-39', percentage: 10.3 },
            { range: '40-44', percentage: 8.6 },
            { range: '45-49', percentage: 5.1 },
            { range: '50-54', percentage: 2.9 },
            { range: '55-59', percentage: 2.0 },
            { range: '60-64', percentage: 1.2 },
            { range: '65-69', percentage: 0.8 },
            { range: '70-74', percentage: 0.4 },
            { range: '75-79', percentage: 0.2 },
            { range: '80-84', percentage: 0.05 },
            { range: '85-89', percentage: 0.0 },
            { range: '90-94', percentage: 0.0 }
        ]

        return NextResponse.json({
            clubName,
            demographics: {
                gender: genderDist,
                age: ageDist
            },
            averageClub: {
                gender: avgGenderDist,
                age: avgAgeDist
            },
            competitionReach: {
                spokes,
                debug: {
                    status: 'Optimized',
                    spokesFound: spokes.length
                }
            }
        })
    } catch (error: any) {
        console.error('Error in demographics API:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
