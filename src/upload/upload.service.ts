import { CustomError, IService, UploadType } from '@/commons/interfaces';
import { DeleteFileDTO, UploadFileDTO } from './upload.dto';
import {
  DeleteObjectCommandOutput,
  PutObjectCommandOutput,
  S3,
} from '@aws-sdk/client-s3';
import env from '@/commons/config';

export default class UploadService implements IService {
  private readonly s3: S3;
  constructor() {
    this.s3 = new S3({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_CLIENT_ID,
        secretAccessKey: env.AWS_SECRET,
      },
    });
  }

  async uploadFile({
    username,
    file,
  }: UploadFileDTO): Promise<PutObjectCommandOutput> {
    const bucket =
      file.fieldname === UploadType.Video
        ? env.AWS_S3_VIDEO_BUCKET
        : env.AWS_S3_DATA_BUCKET;
    const now = Date.now();
    const result = await this.s3.putObject({
      Bucket: bucket,
      Key: `${file.fieldname}/${username}/${now}`,
      ACL: 'public-read',
      ContentType: file.mimetype,
      Body: file.buffer,
    });

    if (!result) {
      throw new CustomError('파일 업로드에 실패했습니다.');
    }

    if (file.fieldname === UploadType.Video) {
      result[
        'url'
      ] = `https://vod.goormedu-clone.com/${file.fieldname}/${username}/${now}/${now}.m3u8`;
    } else {
      result[
        'url'
      ] = `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${file.fieldname}/${username}/${now}`;
    }

    return result;
  }

  async deleteFile({ key }: DeleteFileDTO): Promise<DeleteObjectCommandOutput> {
    const result = await this.s3.deleteObject({
      Bucket: env.AWS_S3_DATA_BUCKET,
      Key: key,
    });

    if (!result) {
      throw new CustomError('파일 삭제에 실패했습니다.');
    }

    return result;
  }

  async deleteVideoFile({
    key,
  }: DeleteFileDTO): Promise<DeleteObjectCommandOutput> {
    const result = await this.s3.deleteObject({
      Bucket: env.AWS_S3_VIDEO_BUCKET,
      Key: key,
    });

    if (!result) {
      throw new CustomError('파일 삭제에 실패했습니다.');
    }

    return result;
  }
}
