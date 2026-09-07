import { NextResponse } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { getImportJob } from '@/lib/db/repository'
import { cancelImportJob, ensureImportJobActive, startImportJobAsync } from '@/lib/import-worker'

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params
    ensureImportJobActive(jobId)
    const job = getImportJob(jobId)

    if (!job) {
      return apiError('No se encontró el proceso de importación.', 404, 'JOB_NOT_FOUND')
    }

    return NextResponse.json({
      ok: true,
      job,
      done: job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled',
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params
    const cancelled = cancelImportJob(jobId)
    const job = getImportJob(jobId)

    return NextResponse.json({
      ok: true,
      cancelled,
      job,
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params
    const job = getImportJob(jobId)
    if (!job) {
      return apiError('No se encontró el proceso.', 404, 'JOB_NOT_FOUND')
    }

    if (job.status === 'completed') {
      return NextResponse.json({ ok: true, job, done: true })
    }

    if (job.status === 'failed' || job.status === 'cancelled') {
      // Re-run the job
      const newJob = await startImportJobAsync(job.boardUrl, {
        wishlistId: job.wishlistId,
        userId: job.userId,
      })
      return NextResponse.json({ ok: true, job: newJob, resumed: true })
    }

    return NextResponse.json({ ok: true, job, done: false })
  } catch (error) {
    return serverError(error)
  }
}
