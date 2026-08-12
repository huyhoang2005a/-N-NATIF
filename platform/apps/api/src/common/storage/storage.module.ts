import { Module } from "@nestjs/common";
import { FileSafetyService } from "../file-safety/file-safety.service";
import { S3Service } from "./s3.service";

@Module({
  providers: [S3Service, FileSafetyService],
  exports: [S3Service, FileSafetyService],
})
export class StorageModule {}
