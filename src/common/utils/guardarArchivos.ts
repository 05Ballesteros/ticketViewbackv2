import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import axios from "axios";
import * as FormData from "form-data";
import * as fs from "fs";

export const guardarArchivos = async (token: string, files: any) => {
    console.log("Archivos a guardar", files);
    console.log("Token", token);
    console.log("Guardando archivos...");
    const formData = new FormData();
    // Agregamos todos los archivos al FormData
    files.forEach((file) => {
        if (!fs.existsSync(file.path)) {
            console.error(`Archivo no encontrado: ${file.path}`);
            throw new InternalServerErrorException(`Archivo no encontrado: ${file.path}`);
        }

        try {
            formData.append("files", fs.createReadStream(file.path), file.originalname);
        } catch (error) {
            console.error(`Error al procesar archivo ${file.path}:`, error);
            throw new InternalServerErrorException(`Error al procesar archivo: ${file.originalname}`);
        }
    });

    try {
        // Enviar una sola petición con todos los archivos
        const response = await axios.post(
            "http://files-service-nest:4401/api/v1/files",
            formData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...formData.getHeaders(),
                },
                withCredentials: false,
            }
        );

        // Eliminar los archivos temporales después de enviarlos
        files.forEach((file) => fs.unlinkSync(file.path));

        if (!response.data || !Array.isArray(response.data)) {
            console.error("Respuesta inválida al guardar archivos:", response);
            throw new BadRequestException('Ocurrió un error al guardar los archivos.');
        }

        console.log("Archivos guardados exitosamente.");
        return response;
    } catch (error) {
        console.error('Error al guardar los archivos:', error);
        throw new InternalServerErrorException('Error interno al guardar archivos.');
    }
};

export default guardarArchivos;
