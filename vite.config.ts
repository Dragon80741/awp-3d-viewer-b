import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const nasBase = '\\\\Doftech_NAS\\AWP_Shared\\3d_test'
const localPhu = path.resolve(process.cwd(), 'PHU_Area_E3D_TILES')
const models: Record<string, string> = {
  '/amiral': path.join(nasBase, 'AMIRAL_NWX_TILES'),
  '/phu': fs.existsSync(localPhu)
    ? localPhu
    : path.join(nasBase, 'PHU_Area_E3D_TILES'),
  '/phu_all': path.join(nasBase, 'PHU_Area_ALL_TILES'),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-model-tiles',
      configureServer(server) {
        Object.entries(models).forEach(([prefix, dir]) => {
          server.middlewares.use(prefix, (req, res, next) => {
            if (!req.url) return next()
            const cleanUrl = decodeURIComponent(req.url.split('?')[0].replace(/^\/+/, ''))
            if (!cleanUrl) return next()
            const filePath = path.join(dir, cleanUrl)

            if (!fs.existsSync(filePath)) {
              res.statusCode = 404
              res.end('Not Found')
              return
            }

            const stat = fs.statSync(filePath)
            if (!stat.isFile()) return next()

            if (filePath.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
            } else if (filePath.endsWith('.glb')) {
              res.setHeader('Content-Type', 'model/gltf-binary')
            } else if (filePath.endsWith('.bin')) {
              res.setHeader('Content-Type', 'application/octet-stream')
            } else if (filePath.endsWith('.txt')) {
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }

            res.setHeader('Content-Length', stat.size)
            res.setHeader('ETag', `"${stat.mtimeMs}-${stat.size}"`)
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', '*')
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, ETag')

            if (req.method === 'OPTIONS') {
              res.end()
              return
            }

            if (req.method === 'HEAD') {
              res.end()
              return
            }

            fs.createReadStream(filePath).pipe(res)
          })
        })
      },
    },
  ],
  resolve: {
    dedupe: ['three', 'react', 'react-dom', 'zustand'],
  },
  server: {
    port: 9200,
  },
})
