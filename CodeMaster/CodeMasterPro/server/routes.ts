import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertAnalysisSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Project management routes
  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid project data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create project" });
      }
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Analysis results routes
  app.post("/api/analysis", async (req, res) => {
    try {
      const analysisData = insertAnalysisSchema.parse(req.body);
      const analysis = await storage.createAnalysisResult(analysisData);
      res.json(analysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid analysis data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create analysis" });
      }
    }
  });

  app.get("/api/analysis/:projectId", async (req, res) => {
    try {
      const results = await storage.getAnalysisResults(req.params.projectId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve analysis results" });
    }
  });

  // Tool execution endpoint
  app.post("/api/tools/spacing", async (req, res) => {
    try {
      const { code, filename } = req.body;
      
      if (!code || typeof code !== 'string') {
        res.status(400).json({ message: "Code is required and must be a string" });
        return;
      }

      // Import and run spacing tool
      const { spacingTool } = await import("../client/src/lib/spacingTool.js");
      const result = await spacingTool.run(code, { filename });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to execute spacing tool" });
    }
  });

  // Workshop communication endpoint
  app.post("/api/workshop/message", async (req, res) => {
    try {
      const { type, data, workshopId } = req.body;
      
      // Log workshop messages for debugging
      console.log(`Workshop Message [${workshopId}]: ${type}`, data);
      
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to process workshop message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
