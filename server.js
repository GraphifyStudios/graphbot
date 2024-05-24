import { apiReference } from "@scalar/express-api-reference";
import cors from "cors";
import express from "express";
import swaggerJsDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.1.0",
  info: {
    title: "Graphical API",
    description: "Access statistics from the Graphify stream programmatically.",
    version: "2.0.0",
  },
  servers: [
    {
      url: "https://graphical.toasted.dev",
    },
  ],
};

const customCss = `
  .download-cta a {
    color: var(--default-theme-color-blue) !important;
  }

  .section-flare {
    display: none
  }

  .introduction-section:before {
    content: " ";
    position: absolute;
    top: 0;
    left: 0;
    right: -120px;
    bottom: 0;
    z-index: 0;
    opacity: 0.1;
    background-image: url('https://i.ibb.co/HKGPhs7/graphical-circle.png');
    background-repeat: no-repeat;
    background-position: 100% 50%;
    background-size: auto 80%;
    pointer-events: none;
  }


  @media (min-width: 498px) {
    .introduction-section:before {
      background-size: auto 100%;
    }
  }

  @media (min-width: 712px) {
    .introduction-section:before {
      background-size: auto 150%;
    }
  }
`;

const app = express().use(cors());

/**
 * @param {{ xp: import("enmap").default, votes: import("enmap").default, points: import("enmap").default, count: import("enmap").default, messages: import("enmap").default, activeUsers: Map }} dbs
 */
export default (dbs) => {
  const openapiSpecification = swaggerJsDoc({
    swaggerDefinition,
    apis: ["./server.js"],
  });

  app.get(
    "/",
    apiReference({
      theme: "bluePlanet",
      customCss,
      spec: {
        content: openapiSpecification,
      },
    })
  );

  app.get("/openapi.json", (_, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(openapiSpecification);
  });

  /**
   * @openapi
   * /xp/top:
   *    get:
   *      description: "Retrive the top 50 users with the most XP."
   *      responses:
   *        200:
   *          description: "Successfully retrived users."
   *          content:
   *            application/json:
   *              schema:
   *                type: array
   *                items:
   *                  type: object
   *                  properties:
   *                    id:
   *                      type: string
   *                    xp:
   *                      type: number
   *                    level:
   *                      type: number
   */
  app.get("/xp/top", (_, res) => {
    const top = dbs.xp
      .keyArray()
      .map((key) => {
        dbs.xp.ensure(key, {
          xp: 0,
          level: 0,
        });
        return {
          id: key,
          ...dbs.xp.get(key),
        };
      })
      .sort(
        (a, b) => (b || { xp: 0, level: 0 }).xp - (a || { xp: 0, level: 0 }).xp
      )
      .slice(0, 50);
    res.json(top);
  });

  /**
   * @openapi
   * /xp/total:
   *    get:
   *      description: "Retrive the total amount of XP."
   *      responses:
   *        200:
   *          description: "Successfully retrived total amount."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  total:
   *                    type: number
   */
  app.get("/xp/total", (req, res) => {
    const total = dbs.xp
      .keyArray()
      .map((key) => {
        dbs.xp.ensure(key, {
          xp: 0,
          level: 0,
        });
        return dbs.xp.get(key, "xp");
      })
      .reduce((a, b) => (a || 0) + (b || 0), 0);
    res.json({
      total,
    });
  });

  /**
   * @openapi
   * /xp/{id}:
   *    get:
   *      description: "Retrive the XP of the specified user ID."
   *      parameters:
   *        - name: id
   *          in: path
   *          required: true
   *          schema:
   *            type: string
   *            description: "A user ID."
   *          example: "UCgG5aRcYGzPPB4UG3mS-ZNg"
   *      responses:
   *        200:
   *          description: "Successfully retrived user."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  id:
   *                    type: string
   *                  xp:
   *                    type: number
   *                  level:
   *                    type: number
   */
  app.get("/xp/:id", (req, res) => {
    const { id } = req.params;
    if (!dbs.xp.has(id))
      return res.status(404).json({
        code: 404,
        message: `No results found for ${id}.`,
      });
    dbs.xp.ensure(id, {
      xp: 0,
      level: 0,
    });
    res.json({
      id,
      ...dbs.xp.get(id),
    });
  });

  /**
   * @openapi
   * /votes/top:
   *    get:
   *      description: "Retrive the top 50 users with the most votes."
   *      responses:
   *        200:
   *          description: "Successfully retrived users."
   *          content:
   *            application/json:
   *              schema:
   *                type: array
   *                items:
   *                  type: object
   *                  properties:
   *                    id:
   *                      type: string
   *                    votes:
   *                      type: number
   */
  app.get("/votes/top", (_, res) => {
    const top = dbs.votes
      .keyArray()
      .map((key) => {
        dbs.votes.ensure(key, 0);
        return {
          name: key,
          votes: dbs.votes.get(key),
        };
      })
      .sort((a, b) => (b || { count: 0 }).count - (a || { count: 0 }).count)
      .slice(0, 50);
    res.json(top);
  });

  /**
   * @openapi
   * /votes/total:
   *    get:
   *      description: "Retrive the total amount of votes."
   *      responses:
   *        200:
   *          description: "Successfully retrived total amount."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  total:
   *                    type: number
   */
  app.get("/votes/total", (req, res) => {
    const total = dbs.votes
      .keyArray()
      .map((key) => {
        dbs.votes.ensure(key, 0);
        return dbs.votes.get(key);
      })
      .reduce((a, b) => (a || 0) + (b || 0), 0);
    res.json({
      total,
    });
  });

  /**
   * @openapi
   * /votes/{id}:
   *    get:
   *      description: "Retrive the votes of the specified user ID."
   *      parameters:
   *        - name: id
   *          in: path
   *          required: true
   *          schema:
   *            type: string
   *            description: "A user ID."
   *          example: "h"
   *      responses:
   *        200:
   *          description: "Successfully retrived user."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  id:
   *                    type: string
   *                  votes:
   *                    type: number
   */
  app.get("/votes/:id", (req, res) => {
    const { id } = req.params;
    const key = dbs.votes.findKey((_, key) => key === id);
    if (!key)
      return res.status(404).json({
        code: 404,
        message: `No results found for ${id}.`,
      });
    dbs.votes.ensure(key, 0);
    res.json({
      name: key,
      votes: dbs.votes.get(key),
    });
  });

  /**
   * @openapi
   * /points/top:
   *    get:
   *      description: "Retrive the top 50 users with the most points."
   *      responses:
   *        200:
   *          description: "Successfully retrived users."
   *          content:
   *            application/json:
   *              schema:
   *                type: array
   *                items:
   *                  type: object
   *                  properties:
   *                    id:
   *                      type: string
   *                    points:
   *                      type: number
   *                    messages:
   *                      type: number
   */
  app.get("/points/top", (_, res) => {
    const top = dbs.points
      .keyArray()
      .map((key) => {
        dbs.points.ensure(key, {
          points: 0,
          messages: 0,
        });
        return {
          id: key,
          ...dbs.points.get(key),
        };
      })
      .sort((a, b) => (b || { points: 0 }).points - (a || { points: 0 }).points)
      .slice(0, 50);
    res.json(top);
  });

  /**
   * @openapi
   * /points/total:
   *    get:
   *      description: "Retrive the total amount of points."
   *      responses:
   *        200:
   *          description: "Successfully retrived total amount."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  total:
   *                    type: number
   */
  app.get("/points/total", (req, res) => {
    const total = dbs.points
      .keyArray()
      .map((key) => {
        dbs.points.ensure(key, {
          points: 0,
        });
        return dbs.points.get(key, "points");
      })
      .reduce((a, b) => (a || 0) + (b || 0), 0);
    res.json({
      total,
    });
  });

  /**
   * @openapi
   * /points/{id}:
   *    get:
   *      description: "Retrive the points of the specified user ID."
   *      parameters:
   *        - name: id
   *          in: path
   *          required: true
   *          schema:
   *            type: string
   *            description: "A user ID."
   *          example: "UCgG5aRcYGzPPB4UG3mS-ZNg"
   *      responses:
   *        200:
   *          description: "Successfully retrived user."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  id:
   *                    type: string
   *                  points:
   *                    type: number
   *                  messages:
   *                    type: number
   */
  app.get("/points/:id", (req, res) => {
    const { id } = req.params;
    if (!dbs.xp.has(id))
      return res.status(404).json({
        code: 404,
        message: `No results found for ${id}.`,
      });
    dbs.points.ensure(id, {
      points: 0,
      messages: 0,
    });
    res.json({
      id,
      ...dbs.points.get(id),
    });
  });

  /**
   * @openapi
   * /active:
   *    get:
   *      description: "Retrive all of the currently active users."
   *      responses:
   *        200:
   *          description: "Successfully retrived users."
   *          content:
   *            application/json:
   *              schema:
   *                type: array
   *                items:
   *                  type: object
   *                  properties:
   *                    id:
   *                      type: string
   *                    name:
   *                      type: string
   *                    date:
   *                      type: integer
   *                      format: int64
   *                      minimum: 1
   *                    messages:
   *                      type: number
   */
  app.get("/active", (req, res) => {
    const values = [...dbs.activeUsers.keys()]
      .map((key) => ({
        id: key,
        ...dbs.activeUsers.get(key),
      }))
      .sort((a, z) => z.messages - a.messages);
    res.json(values);
  });

  /**
   * @openapi
   * /counting:
   *    get:
   *      description: "Retrive statistics about the counting system."
   *      responses:
   *        200:
   *          description: "Successfully retrived counting system statistics."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  count:
   *                    type: number
   *                  lastCounted:
   *                    type: array
   *                    items:
   *                      type: object
   *                      properties:
   *                        name:
   *                          type: string
   *                        id:
   *                          type: string
   *                        count:
   *                          type: number
   */
  app.get("/counting", (req, res) => {
    res.json({
      count: dbs.count.get("count"),
      lastCounted: dbs.count.get("lastCounted"),
    });
  });

  /**
   * @openapi
   * /messages:
   *    get:
   *      description: "Retrive the total amount of messages sent."
   *      responses:
   *        200:
   *          description: "Successfully retrived total amount."
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  messages:
   *                    type: number
   */
  app.get("/messages", (req, res) => {
    res.json({
      messages: dbs.messages.get("messages"),
    });
  });

  app.listen(1539, () => console.log("Listening."));
};