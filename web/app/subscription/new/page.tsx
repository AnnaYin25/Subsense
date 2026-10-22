'use client';

import { Suspense } from 'react';
import SubscriptionForm from '@/components/SubscriptionForm';

export default function NewSubscriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SubscriptionForm />
    </Suspense>
  );
}
