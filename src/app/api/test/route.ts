import { supabase } from '@/lib/supabase/client'
import { testWooCommerceConnection } from '@/lib/woocommerce/client'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Test Supabase connection
        const { data: supabaseTest, error: supabaseError } = await supabase
            .from('categories')
            .select('count(*)')
            .limit(1)

        const supabaseStatus = {
            success: !supabaseError,
            message: supabaseError ? supabaseError.message : 'Supabase connection successful',
            data: supabaseTest
        }

        // Test WooCommerce connection
        const wooCommerceStatus = await testWooCommerceConnection()

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            services: {
                supabase: supabaseStatus,
                woocommerce: wooCommerceStatus
            }
        })
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to test connections',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
} 