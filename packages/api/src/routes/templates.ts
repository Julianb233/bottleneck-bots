import type { FastifyInstance } from 'fastify';
import Docker from 'dockerode';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

interface TemplateInstruction {
  type: 'run' | 'copy' | 'env' | 'workdir' | 'clone';
  args: string[];
}

function generateDockerfile(base: string, instructions: TemplateInstruction[]): string {
  const lines = [`FROM ${base}`];

  for (const inst of instructions) {
    switch (inst.type) {
      case 'run': lines.push(`RUN ${inst.args.join(' ')}`); break;
      case 'copy': lines.push(`COPY ${inst.args.join(' ')}`); break;
      case 'env': lines.push(`ENV ${inst.args.join(' ')}`); break;
      case 'workdir': lines.push(`WORKDIR ${inst.args[0]}`); break;
      case 'clone':
        lines.push(`RUN git clone --depth 1 ${inst.args[0]} ${inst.args[1] || '/home/orgo/repo'}`);
        break;
    }
  }

  return lines.join('\n');
}

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  // List templates (Docker images with bottleneck-template label)
  app.get('/templates', async (_request, reply) => {
    const images = await docker.listImages({
      filters: { label: ['orgo.template=true'] },
    });

    return reply.send({
      templates: images.map(img => ({
        id: img.Id.slice(7, 19),
        tags: img.RepoTags,
        size: img.Size,
        created: new Date(img.Created * 1000).toISOString(),
      })),
    });
  });

  // Build template from instructions
  app.post('/templates/build', async (request, reply) => {
    const { name, base = 'bottleneck-desktop-base:latest', instructions = [] } = request.body as {
      name: string;
      base?: string;
      instructions?: TemplateInstruction[];
    };

    if (!name) {
      return reply.status(400).send({ error: 'validation_error', message: 'Template name is required' });
    }

    const tag = `bottleneck-template-${name}:latest`;
    const dockerfile = generateDockerfile(base, instructions);

    // Write Dockerfile to temp directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bottleneck-template-'));
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), dockerfile);

    try {
      const stream = await docker.buildImage(
        { context: tmpDir, src: ['Dockerfile'] },
        { t: tag, labels: { 'orgo.template': 'true', 'orgo.template.name': name } },
      );

      // Wait for build to complete
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return reply.status(201).send({
        template: { name, tag, dockerfile },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // Delete template
  app.delete('/templates/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const tag = `bottleneck-template-${name}:latest`;

    try {
      const image = docker.getImage(tag);
      await image.remove();
      return reply.send({ deleted: true });
    } catch {
      return reply.status(404).send({ error: 'not_found', message: 'Template not found' });
    }
  });
}
