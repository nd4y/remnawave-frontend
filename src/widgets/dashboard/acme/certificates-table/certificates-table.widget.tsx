import {
    ActionIcon,
    Badge,
    Button,
    Group,
    Paper,
    Stack,
    Table,
    Text,
    Tooltip
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { GetNodesCommand } from '@remnawave/backend-contract'
import { useState } from 'react'
import { TbCertificate, TbListDetails, TbPencil, TbPlus, TbRefresh, TbTrash } from 'react-icons/tb'
import { z } from 'zod'

import { queryClient } from '@shared/api'
import {
    ACME_CERTIFICATE_STATUS,
    AcmeCertificateSchema,
    AcmeCredentialSchema,
    TAcmeCertificateStatus
} from '@shared/api/contracts/acme.contract'
import { QueryKeys, useDeleteAcmeCertificate, useIssueAcmeCertificate } from '@shared/api/hooks'

import { AcmeCertificateDetailsDrawerWidget } from '../certificate-details-drawer/certificate-details-drawer.widget'
import { AcmeCertificateModalWidget } from '../certificate-modal/certificate-modal.widget'

type Certificate = z.infer<typeof AcmeCertificateSchema>
type Credential = z.infer<typeof AcmeCredentialSchema>

interface IProps {
    certificates: Certificate[]
    credentials: Credential[]
    nodes: GetNodesCommand.Response['response']
}

const STATUS_COLORS: Record<TAcmeCertificateStatus, string> = {
    [ACME_CERTIFICATE_STATUS.ACTIVE]: 'teal',
    [ACME_CERTIFICATE_STATUS.AWAITING_DNS]: 'yellow',
    [ACME_CERTIFICATE_STATUS.ERROR]: 'red',
    [ACME_CERTIFICATE_STATUS.ISSUING]: 'blue',
    [ACME_CERTIFICATE_STATUS.PENDING]: 'gray'
}

/** Days left, or null when the certificate has never been issued. */
function daysLeft(expiresAt: Date | null): null | number {
    if (!expiresAt) {
        return null
    }

    return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

export const AcmeCertificatesTableWidget = (props: IProps) => {
    const { certificates, credentials, nodes } = props

    const [editing, setEditing] = useState<Certificate | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [details, setDetails] = useState<Certificate | null>(null)

    const issueCertificate = useIssueAcmeCertificate({})
    const deleteCertificate = useDeleteAcmeCertificate({})

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: QueryKeys.acme.getCertificates.queryKey })

    const handleDelete = (certificate: Certificate) => {
        modals.openConfirmModal({
            children: (
                <Text size="sm">
                    Delete <b>{certificate.name}</b>? Nodes keep serving the certificate they
                    already have until they are restarted.
                </Text>
            ),
            confirmProps: { color: 'red' },
            labels: { cancel: 'Cancel', confirm: 'Delete' },
            onConfirm: async () => {
                await deleteCertificate.mutateAsync({ route: { uuid: certificate.uuid } })
                await invalidate()
            },
            title: 'Delete certificate'
        })
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Text c="dimmed" size="sm">
                    Certificates are issued by the panel and delivered to the nodes they are bound
                    to.
                </Text>

                <Button
                    disabled={credentials.length === 0}
                    leftSection={<TbPlus size={16} />}
                    onClick={() => {
                        setEditing(null)
                        setIsModalOpen(true)
                    }}
                >
                    Add certificate
                </Button>
            </Group>

            {credentials.length === 0 && (
                <Text c="dimmed" size="sm">
                    Add a credential first — a certificate needs one to answer DNS challenges.
                </Text>
            )}

            <Paper p="0" withBorder>
                <Table highlightOnHover striped>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Domains</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Expires</Table.Th>
                            <Table.Th>Nodes</Table.Th>
                            <Table.Th />
                        </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                        {certificates.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={6}>
                                    <Text c="dimmed" py="md" ta="center">
                                        No certificates yet.
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        )}

                        {certificates.map((certificate) => {
                            const left = daysLeft(certificate.expiresAt)

                            return (
                                <Table.Tr key={certificate.uuid}>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <TbCertificate size={16} />
                                            <Text>{certificate.name}</Text>
                                            {!certificate.isEnabled && (
                                                <Badge color="gray" size="xs" variant="light">
                                                    disabled
                                                </Badge>
                                            )}
                                        </Group>
                                    </Table.Td>

                                    <Table.Td>
                                        <Group gap="4">
                                            {certificate.domains.map((domain) => (
                                                <Badge key={domain} size="sm" variant="default">
                                                    {domain}
                                                </Badge>
                                            ))}
                                        </Group>
                                    </Table.Td>

                                    <Table.Td>
                                        <Badge
                                            color={STATUS_COLORS[certificate.status]}
                                            variant="light"
                                        >
                                            {certificate.status}
                                        </Badge>
                                    </Table.Td>

                                    <Table.Td>
                                        {left === null ? (
                                            <Text c="dimmed">—</Text>
                                        ) : (
                                            <Text
                                                c={
                                                    left <= certificate.renewBeforeDays
                                                        ? 'yellow'
                                                        : undefined
                                                }
                                            >
                                                {left} d
                                            </Text>
                                        )}
                                    </Table.Td>

                                    <Table.Td>
                                        <Group gap="4">
                                            {certificate.nodes.length === 0 && (
                                                <Text c="dimmed">not bound</Text>
                                            )}

                                            {certificate.nodes.map((binding) => (
                                                <Tooltip
                                                    key={binding.nodeUuid}
                                                    label={
                                                        binding.inboundTags.length === 0
                                                            ? 'All TLS inbounds'
                                                            : binding.inboundTags.join(', ')
                                                    }
                                                >
                                                    <Badge size="sm" variant="outline">
                                                        {binding.nodeName ?? binding.nodeUuid}
                                                    </Badge>
                                                </Tooltip>
                                            ))}
                                        </Group>
                                    </Table.Td>

                                    <Table.Td>
                                        <Group gap="xs" justify="flex-end">
                                            <Tooltip label="Issue or renew now">
                                                <ActionIcon
                                                    loading={issueCertificate.isPending}
                                                    onClick={async () => {
                                                        await issueCertificate.mutateAsync({
                                                            route: { uuid: certificate.uuid }
                                                        })
                                                        await invalidate()
                                                    }}
                                                    variant="subtle"
                                                >
                                                    <TbRefresh size={18} />
                                                </ActionIcon>
                                            </Tooltip>

                                            <Tooltip label="Log and authorization record">
                                                <ActionIcon
                                                    onClick={() => setDetails(certificate)}
                                                    variant="subtle"
                                                >
                                                    <TbListDetails size={18} />
                                                </ActionIcon>
                                            </Tooltip>

                                            <ActionIcon
                                                onClick={() => {
                                                    setEditing(certificate)
                                                    setIsModalOpen(true)
                                                }}
                                                variant="subtle"
                                            >
                                                <TbPencil size={18} />
                                            </ActionIcon>

                                            <ActionIcon
                                                color="red"
                                                onClick={() => handleDelete(certificate)}
                                                variant="subtle"
                                            >
                                                <TbTrash size={18} />
                                            </ActionIcon>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            )
                        })}
                    </Table.Tbody>
                </Table>
            </Paper>

            <AcmeCertificateModalWidget
                certificate={editing}
                credentials={credentials}
                nodes={nodes}
                onClose={() => setIsModalOpen(false)}
                opened={isModalOpen}
            />

            <AcmeCertificateDetailsDrawerWidget
                certificate={details}
                onClose={() => setDetails(null)}
            />
        </Stack>
    )
}
