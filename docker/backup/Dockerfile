# Backups: pg_dump (misma versión que la base) + rclone para la copia fuera del servidor.
FROM postgres:16-alpine
RUN apk add --no-cache rclone tar gzip
COPY backup.sh /backup.sh
ENTRYPOINT ["sh", "/backup.sh"]
