# ISHQARA - Premium Perfume E-Commerce Web App

## Overview
A mobile-responsive e-commerce web application for ISHQARA, a premium perfume brand. Features a bright, clean, "treat yourself" aesthetic targeting GenZ audiences. Built with React + Express + PostgreSQL.

## Architecture
- **Frontend**: React with TanStack Query, Wouter routing, Shadcn UI, Tailwind CSS
- **Backend**: Express.js with RESTful API endpoints
- **Database**: PostgreSQL with Drizzle ORM
- **State**: Server state via TanStack Query, Cart state via localStorage

## Key Pages
- `/` - Homepage with hero, bestsellers, trending, size guide, bundle CTA
- `/shop` - Product catalog with filters (category, gender, sort)
- `/product/:id` - Product detail with sizes, reviews, add to cart
- `/cart` - Shopping cart with quantity management
- `/checkout` - Checkout with delivery details, COD/Razorpay payment
- `/deals` - Promotions and discounted products
- `/bundles` - Build-your-own gift bundle (pick 2 or 3, get discount)
- `/admin` - Admin dashboard with orders, products, promotions, subscribers management

## API Endpoints
- `GET /api/products` - List all products with sizes
- `GET /api/products/:id` - Single product detail
- `GET /api/products/:id/reviews` - Product reviews
- `POST /api/products/:id/reviews` - Add review
- `GET /api/promotions` - List promotions
- `POST /api/orders` - Place order
- `POST /api/subscribers` - Subscribe email/phone
- `GET /api/admin/orders` - Admin: list orders
- `PATCH /api/orders/:id` - Update order status
- `POST /api/admin/products` - Add product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `POST /api/admin/promotions` - Add promotion
- `PATCH /api/admin/promotions/:id` - Toggle promotion
- `GET /api/admin/subscribers` - List subscribers

## Design Tokens
- Primary: Rose/warm pink (hue 350)
- Fonts: Plus Jakarta Sans (body), Playfair Display (headings)
- Bright, clean aesthetic with warm tones

## Database
- PostgreSQL with Drizzle ORM
- Tables: users, products, product_sizes, reviews, orders, promotions, subscribers
- Seed data: 8 perfume products, sample reviews, 3 promotions
