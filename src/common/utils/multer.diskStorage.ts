// src/common/utils/multer-options.ts
import { diskStorage } from 'multer';
import * as path from 'path';

export const multerOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      // ruta absoluta a src/temp
      const uploadPath = path.join(process.cwd(), 'src', 'temp');
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
  fileFilter: (_req, file, cb) => {
    // opcional: validar mimetype, extensiones, etc.
    cb(null, true);
  },
};
