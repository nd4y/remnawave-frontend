import { Tabs } from '@mantine/core'
import { GetNodesCommand } from '@remnawave/backend-contract'
import { AcmeCertificatesTableWidget } from '@widgets/dashboard/acme/certificates-table/certificates-table.widget'
import { AcmeCredentialsTableWidget } from '@widgets/dashboard/acme/credentials-table/credentials-table.widget'
import { motion } from 'motion/react'
import { TbCertificate, TbKey } from 'react-icons/tb'
import { z } from 'zod'

import { AcmeCertificateSchema, AcmeCredentialSchema } from '@shared/api/contracts/acme.contract'
import { Page, PageHeaderShared } from '@shared/ui'

interface Props {
    certificates: z.infer<typeof AcmeCertificateSchema>[]
    credentials: z.infer<typeof AcmeCredentialSchema>[]
    nodes: GetNodesCommand.Response['response']
}

export const AcmePageComponent = (props: Props) => {
    const { certificates, credentials, nodes } = props

    return (
        <Page title="Certificates">
            <PageHeaderShared icon={<TbCertificate size={24} />} title="Certificates" />

            <motion.div
                animate={{ opacity: 1 }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Tabs defaultValue="certificates" keepMounted={false}>
                    <Tabs.List mb="md">
                        <Tabs.Tab
                            leftSection={<TbCertificate size={16} />}
                            value="certificates"
                        >
                            Certificates
                        </Tabs.Tab>
                        <Tabs.Tab leftSection={<TbKey size={16} />} value="credentials">
                            Credentials
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="certificates">
                        <AcmeCertificatesTableWidget
                            certificates={certificates}
                            credentials={credentials}
                            nodes={nodes}
                        />
                    </Tabs.Panel>

                    <Tabs.Panel value="credentials">
                        <AcmeCredentialsTableWidget credentials={credentials} />
                    </Tabs.Panel>
                </Tabs>
            </motion.div>
        </Page>
    )
}
