import { Badge, Button, Center, Group, Menu, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { GetNodesCommand } from '@remnawave/backend-contract'
import { useState } from 'react'
import { PiPencil, PiTrashDuotone } from 'react-icons/pi'
import {
    TbCertificate,
    TbFileUpload,
    TbListDetails,
    TbPlus,
    TbRefresh,
    TbServer
} from 'react-icons/tb'
import { z } from 'zod'

import { queryClient } from '@shared/api'
import {
    ACME_CERTIFICATE_SOURCE,
    ACME_CERTIFICATE_STATUS,
    AcmeCertificateSchema,
    AcmeCredentialSchema,
    TAcmeCertificateStatus
} from '@shared/api/contracts/acme.contract'
import { QueryKeys, useDeleteAcmeCertificate, useIssueAcmeCertificate } from '@shared/api/hooks'
import { EntityCardShared } from '@shared/ui/entity-card'
import { VirtualizedDndGrid } from '@shared/ui/virtualized-dnd-grid'

import { AcmeCertificateDetailsDrawerWidget } from '../certificate-details-drawer/certificate-details-drawer.widget'
import { AcmeCertificateModalWidget } from '../certificate-modal/certificate-modal.widget'
import { AcmeImportCertificateModalWidget } from '../import-certificate-modal/import-certificate-modal.widget'

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

export const AcmeCertificatesGridWidget = (props: IProps) => {
    const { certificates, credentials, nodes } = props

    const [editing, setEditing] = useState<Certificate | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [details, setDetails] = useState<Certificate | null>(null)
    const [replacing, setReplacing] = useState<Certificate | null>(null)
    const [isImportOpen, setIsImportOpen] = useState(false)

    const issueCertificate = useIssueAcmeCertificate({})
    const deleteCertificate = useDeleteAcmeCertificate({})

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: QueryKeys.acme.getCertificates.queryKey })

    const handleIssue = async (certificate: Certificate) => {
        await issueCertificate.mutateAsync({ route: { uuid: certificate.uuid } })
        await invalidate()

        notifications.show({
            color: 'teal',
            message: 'Issuance queued',
            title: certificate.name
        })
    }

    const handleDelete = (certificate: Certificate) => {
        modals.openConfirmModal({
            cancelProps: { variant: 'subtle' },
            centered: true,
            children: (
                <Text size="sm">
                    Delete <b>{certificate.name}</b>? Nodes keep serving the certificate they
                    already have until they are restarted.
                </Text>
            ),
            confirmProps: { color: 'red', variant: 'soft' },
            labels: { cancel: 'Cancel', confirm: 'Delete' },
            onConfirm: async () => {
                await deleteCertificate.mutateAsync({ route: { uuid: certificate.uuid } })
                await invalidate()
            },
            title: 'Delete certificate'
        })
    }

    const renderCard = (certificate: Certificate) => {
        const left = daysLeft(certificate.expiresAt)
        const isImported = certificate.source === ACME_CERTIFICATE_SOURCE.IMPORTED
        const isActive = certificate.status === ACME_CERTIFICATE_STATUS.ACTIVE

        return (
            <EntityCardShared.Root withTopAccent={isActive}>
                <EntityCardShared.Header>
                    <EntityCardShared.Icon
                        highlight={isActive}
                        onClick={() => setDetails(certificate)}
                    >
                        <TbCertificate size={28} />
                    </EntityCardShared.Icon>

                    <EntityCardShared.Content
                        subtitle={certificate.domains.join(', ')}
                        title={certificate.name}
                    >
                        <Group gap="xs" wrap="wrap">
                            <Badge
                                color={STATUS_COLORS[certificate.status]}
                                size="lg"
                                variant="soft"
                            >
                                {certificate.status}
                            </Badge>

                            {left !== null && (
                                <Tooltip label="Days until expiry">
                                    <Badge
                                        color={
                                            left <= certificate.renewBeforeDays ? 'yellow' : 'gray'
                                        }
                                        size="lg"
                                        variant="soft"
                                    >
                                        {left} d
                                    </Badge>
                                </Tooltip>
                            )}

                            <Tooltip
                                label={
                                    certificate.nodes.length === 0
                                        ? 'Not bound to any node'
                                        : certificate.nodes
                                              .map(
                                                  (binding) => binding.nodeName ?? binding.nodeUuid
                                              )
                                              .join(', ')
                                }
                            >
                                <Badge
                                    color={certificate.nodes.length > 0 ? 'blue' : 'gray'}
                                    leftSection={<TbServer size={12} />}
                                    size="lg"
                                    variant="soft"
                                >
                                    {certificate.nodes.length}
                                </Badge>
                            </Tooltip>

                            {isImported && (
                                <Tooltip label="Uploaded material, never renewed by the panel">
                                    <Badge color="grape" size="lg" variant="soft">
                                        imported
                                    </Badge>
                                </Tooltip>
                            )}

                            {!certificate.isEnabled && (
                                <Badge color="gray" size="lg" variant="soft">
                                    disabled
                                </Badge>
                            )}
                        </Group>
                    </EntityCardShared.Content>
                </EntityCardShared.Header>

                <EntityCardShared.Actions>
                    {isImported ? (
                        <EntityCardShared.Button
                            leftSection={<TbFileUpload size={16} />}
                            onClick={() => {
                                setReplacing(certificate)
                                setIsImportOpen(true)
                            }}
                        >
                            Upload
                        </EntityCardShared.Button>
                    ) : (
                        <EntityCardShared.Button
                            leftSection={<TbRefresh size={16} />}
                            onClick={() => handleIssue(certificate)}
                        >
                            Issue now
                        </EntityCardShared.Button>
                    )}

                    <EntityCardShared.Menu>
                        <Menu.Item
                            leftSection={<TbListDetails size={18} />}
                            onClick={() => setDetails(certificate)}
                        >
                            Details
                        </Menu.Item>

                        <Menu.Item
                            leftSection={<PiPencil size={18} />}
                            onClick={() => {
                                setEditing(certificate)
                                setIsModalOpen(true)
                            }}
                        >
                            Edit
                        </Menu.Item>

                        <Menu.Item
                            color="red"
                            leftSection={<PiTrashDuotone size={18} />}
                            onClick={() => handleDelete(certificate)}
                        >
                            Delete
                        </Menu.Item>
                    </EntityCardShared.Menu>
                </EntityCardShared.Actions>
            </EntityCardShared.Root>
        )
    }

    return (
        <Stack gap="md">
            <Group justify="flex-end">
                <Button
                    leftSection={<TbFileUpload size={16} />}
                    onClick={() => {
                        setReplacing(null)
                        setIsImportOpen(true)
                    }}
                    variant="default"
                >
                    Import
                </Button>

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

            {certificates.length === 0 && (
                <Center py="xl">
                    <Stack align="center" gap="lg">
                        <ThemeIcon color="gray" radius="xl" size={64} variant="soft">
                            <TbCertificate size={32} />
                        </ThemeIcon>

                        <Stack align="center" gap="xs">
                            <Text fw={600} size="lg" ta="center">
                                No certificates yet
                            </Text>
                            <Text c="dimmed" maw={400} size="sm" ta="center">
                                {credentials.length === 0
                                    ? 'Add a credential first — a certificate needs one to answer DNS challenges.'
                                    : 'Create a certificate, or import one issued elsewhere.'}
                            </Text>
                        </Stack>
                    </Stack>
                </Center>
            )}

            {certificates.length > 0 && (
                <VirtualizedDndGrid
                    enableDnd={false}
                    items={certificates}
                    renderItem={renderCard}
                    useWindowScroll={true}
                />
            )}

            <AcmeCertificateModalWidget
                certificate={editing}
                credentials={credentials}
                nodes={nodes}
                onClose={() => setIsModalOpen(false)}
                opened={isModalOpen}
            />

            <AcmeImportCertificateModalWidget
                certificate={replacing}
                nodes={nodes}
                onClose={() => setIsImportOpen(false)}
                opened={isImportOpen}
            />

            <AcmeCertificateDetailsDrawerWidget
                certificate={details}
                onClose={() => setDetails(null)}
            />
        </Stack>
    )
}
