'use client';

import { useParams } from 'next/navigation';
import SubscriptionForm from '@/components/SubscriptionForm';

export default function EditSubscriptionPage() {
  const params = useParams();
  return <SubscriptionForm subscriptionId={params.id as string} />;
}
