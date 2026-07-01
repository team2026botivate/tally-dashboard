# GODMODE MASTER PROMPT — Enterprise TallyPrime Remote Data Gateway

You are a Principal Software Architect, Cyber Security Engineer, DevOps Engineer, Backend Engineer, Network Engineer, Windows Engineer, React Architect, Electron Architect, Database Architect, API Architect, and Enterprise Solution Designer.

Your task is to design and implement a production-grade enterprise system that allows my SaaS application to securely access ONLY TallyPrime business data from a client's Windows PC.

This system must NEVER provide desktop remote control, file explorer access, keyboard/mouse control, or unrestricted access to the client's computer.

The ONLY purpose is reading and optionally writing TallyPrime business data through official interfaces.

---

## Objective

Build an Enterprise Remote Tally Gateway.

Architecture:

Client Windows PC
│
├── TallyPrime
│
├── Tally XML API
│
├── Local Gateway Service
│
├── HTTPS API
│
├── Authentication Layer
│
├── Encryption
│
└── Outbound Secure Tunnel
│
Internet
│
Cloud Server
│
Node.js API
│
Supabase
│
React Dashboard

My website should never connect directly to the client's PC.

The client PC should establish an outbound encrypted connection to my cloud server.

No inbound ports should need to be opened by the client.

---

## Technology Stack

Frontend

React

Vite

TypeScript

Tailwind CSS

Backend

Node.js

Express

Socket.IO or WebSocket

JWT Authentication

Supabase PostgreSQL

Redis (optional)

Client Agent

Node.js

Windows Service

Electron (optional)

PM2 or NSSM

HTTPS

Networking

Reverse Tunnel

WebSocket

TLS 1.3

Automatic reconnect

Heartbeat

Offline detection

Database

Supabase PostgreSQL

---

## Features

Generate a unique Client ID.

Generate Device Token.

Generate API Secret.

Generate JWT.

Generate Refresh Token.

Generate Installation Token.

---

## Client Agent

The installer should:

Install the Gateway.

Register the device.

Generate secure keys.

Store encrypted credentials.

Run automatically on Windows startup.

Reconnect after reboot.

Reconnect after internet loss.

Monitor Tally.

Monitor Gateway.

Send heartbeat every 30 seconds.

---

## Tally Integration

Use only official TallyPrime XML Gateway.

Allow:

List Companies

Current Company

Ledgers

Groups

Stock Items

Stock Groups

Godowns

Voucher Types

Sales

Purchase

Payment

Receipt

Journal

Contra

Debit Note

Credit Note

Day Book

Trial Balance

Balance Sheet

Profit & Loss

GST Reports

Outstanding Reports

Stock Summary

Sales Register

Purchase Register

Voucher Creation

Voucher Update

Ledger Creation

Ledger Update

Stock Update

Everything should use Tally XML Requests.

No database scraping.

No DLL injection.

No memory reading.

No unsupported techniques.

---

## Security

AES-256 encryption.

TLS 1.3.

JWT Authentication.

Refresh Tokens.

Device Binding.

Machine Fingerprinting.

Encrypted local secrets.

IP validation.

Rate limiting.

Replay attack protection.

API signing.

Request hashing.

Automatic key rotation.

---

## Permissions

The gateway must expose ONLY Tally APIs.

Never expose:

Desktop

Files

Folders

Clipboard

Keyboard

Mouse

PowerShell

CMD

Registry

Processes

Camera

Microphone

Windows Explorer

Any unrelated application

Only Tally.

Nothing else.

---

## Dashboard

React Dashboard

Connected Clients

Online Status

Offline Status

Company Name

Tally Version

License Status

Gateway Status

Last Sync

Device Name

OS Version

Public IP

Private IP

Logs

Buttons:

Connect

Disconnect

Sync

Restart Gateway

Restart Tally

Refresh Data

Generate Reports

Export Excel

Export PDF

---

## APIs

POST /register

POST /login

POST /heartbeat

GET /companies

GET /ledgers

GET /stock

GET /vouchers

GET /reports

POST /voucher

POST /ledger

POST /stock

POST /sync

POST /disconnect

POST /restart

---

## Deployment

Node.js Backend

Docker

NGINX

HTTPS

SSL

Automatic Updates

GitHub Actions CI/CD

PM2

Logging

Monitoring

Crash Recovery

---

## Installer

Generate:

Windows Installer (.exe)

Silent Installation

Automatic Update System

Uninstaller

Auto Start

Service Registration

Configuration Wizard

---

## Documentation

Generate:

Folder Structure

Architecture Diagram

API Documentation

Database Schema

ER Diagram

Deployment Guide

Windows Installation Guide

Cloud Deployment Guide

Security Guide

Troubleshooting Guide

---

## Coding Standards

Production Ready

Enterprise Ready

Highly Modular

SOLID Principles

Clean Architecture

Repository Pattern

Dependency Injection

Error Handling

Retry Logic

Logging

Unit Tests

Integration Tests

Security Tests

Performance Optimized

Scalable

Maintainable

Documented

---

## Final Deliverables

Generate the complete source code for:

1. React Dashboard
2. Node.js Backend
3. Windows Gateway Service
4. Tally XML Integration Layer
5. Supabase SQL Schema
6. Authentication System
7. Device Registration
8. WebSocket Communication
9. Installer
10. Auto Update System
11. API Documentation
12. Deployment Scripts
13. Docker Configuration
14. CI/CD Pipeline
15. Security Documentation

The generated system must expose ONLY TallyPrime business data with the customer's authorization and must never provide general remote access to the client's computer or unrelated data.
