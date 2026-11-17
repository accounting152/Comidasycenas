# Comidas y Cenas

Web personal para guardar recetas de vídeos de Instagram en el iPhone, ordenadas por dificultad (fácil, medio, difícil).

- Pega el enlace del reel o post y se ve el vídeo dentro de la receta.
- Pega el texto del post con los ingredientes y los pasos; mientras cocinas puedes tachar líneas.
- Busca por nombre o ingrediente, filtra por dificultad y marca favoritas.
- Las recetas se guardan en el propio móvil. En Ajustes puedes exportar e importar una copia.

## Publicar con GitHub Pages

1. En GitHub: **Settings → Pages**.
2. En *Build and deployment*, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guarda.
3. A los pocos minutos estará en `https://accounting152.github.io/Comidasycenas/`.

## Instalar en el iPhone

Abre la web en Safari → botón **Compartir** → **Añadir a pantalla de inicio**.

## Abrir el formulario con datos

La web acepta `?url=…&text=…&title=…` y abre una receta nueva ya rellenada. Sirve para crear un Atajo de iOS que reciba un enlace desde la hoja de compartir de Instagram.

## Por qué no descarga los vídeos

Una web en GitHub Pages no tiene servidor propio, e Instagram no permite que otras webs lean sus posts ni descarguen sus vídeos. Por eso el vídeo se muestra con el reproductor oficial de Instagram (necesita conexión) y el texto se pega a mano.
