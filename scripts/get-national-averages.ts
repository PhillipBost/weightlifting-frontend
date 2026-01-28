
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local')
dotenv.config({ path: envPath })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function calculateAverages() {
    console.log('Calculating National Averages (Last 24 Months)...')

    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const dateStr = twoYearsAgo.toISOString().split('T')[0]

    // Fetch ALL results (using pagination if needed, or just a very large limit if possible)
    // Actually, count group by is better but Supabase JS doesn't support easy GROUP BY counts without RPC.
    // We will fetch essential columns in chunks.

    let allGenders: string[] = []
    let allAges: number[] = []

    const chunkSize = 10000
    let offset = 0
    let fetchMore = true

    while (fetchMore) {
        console.log(`Fetching chunk starting at ${offset}...`)
        const { data, error } = await supabase
            .from('usaw_meet_results')
            .select('gender, competition_age')
            .gte('date', dateStr)
            .range(offset, offset + chunkSize - 1)

        if (error) {
            console.error('Error:', error)
            break
        }

        if (!data || data.length === 0) {
            fetchMore = false
            break
        }

        data.forEach(r => {
            if (r.gender) allGenders.push(r.gender)
            if (r.competition_age) allAges.push(r.competition_age)
        })

        if (data.length < chunkSize) fetchMore = false
        offset += chunkSize
    }

    console.log(`Total Records Processed: ${allGenders.length}`)

    // Gender Stats
    const totalGender = allGenders.length
    const maleCount = allGenders.filter(g => g === 'M').length
    const femaleCount = allGenders.filter(g => g === 'F').length

    const genderDist = [
        { name: 'Male', value: (maleCount / totalGender) * 100 },
        { name: 'Female', value: (femaleCount / totalGender) * 100 }
    ]

    // Age Stats
    function getAgeBucket(age: number): string {
        if (age < 15) return 'Under 15'
        if (age >= 100) return '100+'
        const start = Math.floor(age / 5) * 5
        const end = start + 4
        return `${start}-${end}`
    }

    const ageCounts: Record<string, number> = {}
    allAges.forEach(age => {
        const b = getAgeBucket(age)
        ageCounts[b] = (ageCounts[b] || 0) + 1
    })

    const ageDist = Object.entries(ageCounts).map(([range, count]) => ({
        range,
        percentage: (count / allAges.length) * 100
    })).sort((a, b) => {
        const getStartAge = (range: string) => {
            if (range === 'Under 15') return 0
            if (range === '100+') return 100
            return parseInt(range.split('-')[0])
        }
        return getStartAge(a.range) - getStartAge(b.range)
    })

    console.log('\n--- RESULTS ---')
    console.log('GENDER:')
    console.log(JSON.stringify(genderDist, null, 2))
    console.log('AGE:')
    console.log(JSON.stringify(ageDist, null, 2))
}

calculateAverages()
