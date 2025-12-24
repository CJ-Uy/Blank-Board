import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	CreateBucketCommand,
	PutBucketPolicyCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

// Skip initialization during build
if (!building) {
	if (!env.MINIO_URL) throw new Error('MINIO_URL is not set');
	if (!env.MINIO_USER) throw new Error('MINIO_USER is not set');
	if (!env.MINIO_PASSWORD) throw new Error('MINIO_PASSWORD is not set');
	if (!env.MINIO_BUCKET) throw new Error('MINIO_BUCKET is not set');
}

function getS3Client() {
	return new S3Client({
		endpoint: env.MINIO_URL,
		region: 'us-east-1', // MinIO doesn't care about region, but SDK requires it
		credentials: {
			accessKeyId: env.MINIO_USER!,
			secretAccessKey: env.MINIO_PASSWORD!
		},
		forcePathStyle: true // Required for MinIO
	});
}

function getBucket() {
	return env.MINIO_BUCKET!;
}

// Public read policy for the bucket
function getPublicReadPolicy(bucket: string) {
	return {
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Principal: { AWS: ['*'] },
				Action: ['s3:GetObject'],
				Resource: [`arn:aws:s3:::${bucket}/*`]
			}
		]
	};
}

let bucketInitialized = false;

// Ensure bucket exists and is publicly readable
async function ensureBucket() {
	if (bucketInitialized || building) return;

	const s3Client = getS3Client();
	const bucket = getBucket();

	try {
		await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
		console.log(`Bucket ${bucket} exists`);

		// Always try to set public read policy on existing bucket
		try {
			await s3Client.send(
				new PutBucketPolicyCommand({
					Bucket: bucket,
					Policy: JSON.stringify(getPublicReadPolicy(bucket))
				})
			);
			console.log(`Set public read policy on bucket: ${bucket}`);
		} catch (policyError) {
			console.warn(`Could not set bucket policy (may already be set or lack permissions):`, policyError);
		}
	} catch (error: unknown) {
		const isNotFound =
			error &&
			typeof error === 'object' &&
			'name' in error &&
			(error.name === 'NotFound' || error.name === 'NoSuchBucket');

		if (isNotFound) {
			// Create the bucket
			await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
			console.log(`Created bucket: ${bucket}`);

			// Set public read policy
			await s3Client.send(
				new PutBucketPolicyCommand({
					Bucket: bucket,
					Policy: JSON.stringify(getPublicReadPolicy(bucket))
				})
			);
			console.log(`Set public read policy on bucket: ${bucket}`);
		} else {
			console.error('Error checking bucket:', error);
		}
	}

	bucketInitialized = true;
}

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
	await ensureBucket();

	const s3Client = getS3Client();
	const bucket = getBucket();

	await s3Client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType
		})
	);

	// Return the public URL for the file
	return `${env.MINIO_URL}/${bucket}/${key}`;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
	const s3Client = getS3Client();
	const bucket = getBucket();

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key
	});

	return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getFile(key: string): Promise<{ body: Buffer; contentType: string }> {
	const s3Client = getS3Client();
	const bucket = getBucket();

	const response = await s3Client.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: key
		})
	);

	const body = await response.Body?.transformToByteArray();
	if (!body) throw new Error('Empty response body');

	return {
		body: Buffer.from(body),
		contentType: response.ContentType || 'application/octet-stream'
	};
}
